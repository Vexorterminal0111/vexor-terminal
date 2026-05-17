// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {VexorToken} from "../src/VexorToken.sol";
import {VexorRevShare} from "../src/VexorRevShare.sol";

/// @notice Comprehensive unit tests for VexorRevShare.
///         Token uses VexorToken (the Sepolia $VT) — semantically identical to the mainnet
///         $VT for ERC-20 transfer/approve behaviour (both are standard ERC-20Votes).
contract VexorRevShareTest is Test {
    VexorToken internal token;
    VexorRevShare internal pool;

    address internal owner   = address(0xA11CE);
    address internal alice   = address(0xBEEF);
    address internal bob     = address(0xCAFE);
    address internal carol   = address(0xD00D);
    address internal nobody  = address(0xFA11);

    function setUp() public {
        vm.prank(owner);
        token = new VexorToken(owner);

        vm.prank(owner);
        pool = new VexorRevShare(token, owner);

        // owner already minted 10M $VT to themselves; distribute test balances
        vm.startPrank(owner);
        token.transfer(alice, 100_000 ether);
        token.transfer(bob,   100_000 ether);
        token.transfer(carol, 100_000 ether);
        vm.stopPrank();

        // approve the pool for the stakers
        vm.prank(alice);  token.approve(address(pool), type(uint256).max);
        vm.prank(bob);    token.approve(address(pool), type(uint256).max);
        vm.prank(carol);  token.approve(address(pool), type(uint256).max);
        vm.prank(owner);  token.approve(address(pool), type(uint256).max);
    }

    // -------------------------------------------------------------
    // Constructor + ownership
    // -------------------------------------------------------------

    function test_Constructor_SetsState() public view {
        assertEq(address(pool.stakingToken()), address(token));
        assertEq(pool.owner(), owner);
        assertEq(pool.totalStaked(), 0);
        assertEq(pool.accRewardPerToken(), 0);
    }

    function test_Constructor_RevertsOnZeroToken() public {
        vm.expectRevert("VRS: zero token");
        new VexorRevShare(VexorToken(address(0)), owner);
    }

    // -------------------------------------------------------------
    // stake()
    // -------------------------------------------------------------

    function test_Stake_UpdatesBalanceAndTotal() public {
        vm.prank(alice);
        pool.stake(10_000 ether);

        assertEq(pool.balanceOf(alice), 10_000 ether);
        assertEq(pool.totalStaked(), 10_000 ether);
        assertEq(token.balanceOf(address(pool)), 10_000 ether);
        assertEq(token.balanceOf(alice), 90_000 ether);
        assertTrue(pool.isStaker(alice));
        assertFalse(pool.isStaker(bob));
    }

    function test_Stake_RevertsOnZero() public {
        vm.prank(alice);
        vm.expectRevert("VRS: zero amount");
        pool.stake(0);
    }

    function test_Stake_TopUp_AutoClaimsPending() public {
        // alice stakes 10k
        vm.prank(alice);
        pool.stake(10_000 ether);

        // owner pushes 500 in rewards (alice is the only staker → gets all)
        vm.prank(owner);
        pool.pushRewards(500 ether);

        assertEq(pool.pending(alice), 500 ether);

        // alice tops up by another 5k. Expect: 500 paid out, balance becomes 15k.
        uint256 aliceWalletBefore = token.balanceOf(alice);
        vm.prank(alice);
        pool.stake(5_000 ether);
        uint256 aliceWalletAfter = token.balanceOf(alice);

        assertEq(pool.balanceOf(alice), 15_000 ether);
        assertEq(pool.pending(alice), 0);
        // Net wallet delta: -5_000 (new stake) + 500 (pending) = -4_500
        assertEq(aliceWalletBefore - aliceWalletAfter, 4_500 ether);
    }

    // -------------------------------------------------------------
    // pushRewards()
    // -------------------------------------------------------------

    function test_PushRewards_OnlyOwner() public {
        vm.prank(alice);  pool.stake(1_000 ether);

        vm.prank(bob);
        vm.expectRevert(); // OZ Ownable v5 → OwnableUnauthorizedAccount(address)
        pool.pushRewards(100 ether);
    }

    function test_PushRewards_RevertsOnZero() public {
        vm.prank(alice);  pool.stake(1_000 ether);

        vm.prank(owner);
        vm.expectRevert("VRS: zero amount");
        pool.pushRewards(0);
    }

    function test_PushRewards_RevertsWhenNoStakers() public {
        vm.prank(owner);
        vm.expectRevert("VRS: no stakers");
        pool.pushRewards(100 ether);
    }

    function test_PushRewards_SingleStaker_GetsFullAmount() public {
        vm.prank(alice);  pool.stake(10_000 ether);

        vm.prank(owner);
        pool.pushRewards(1_000 ether);

        assertEq(pool.pending(alice), 1_000 ether);
    }

    function test_PushRewards_TwoStakers_ProRata() public {
        // alice 30k, bob 70k → alice should get 30%, bob 70%
        vm.prank(alice);  pool.stake(30_000 ether);
        vm.prank(bob);    pool.stake(70_000 ether);

        vm.prank(owner);
        pool.pushRewards(1_000 ether);

        assertEq(pool.pending(alice), 300 ether);
        assertEq(pool.pending(bob),   700 ether);
    }

    function test_PushRewards_NewStakerDoesNotGetPriorRewards() public {
        // alice stakes first, owner pushes rewards
        vm.prank(alice);  pool.stake(10_000 ether);
        vm.prank(owner);
        pool.pushRewards(500 ether);

        // bob joins AFTER — should NOT see any of the 500
        vm.prank(bob);  pool.stake(10_000 ether);
        assertEq(pool.pending(bob), 0);

        // next push of 200 is shared 50/50
        vm.prank(owner);
        pool.pushRewards(200 ether);

        assertEq(pool.pending(alice), 500 ether + 100 ether);
        assertEq(pool.pending(bob),   100 ether);
    }

    function test_PushRewards_AccumulatorMonotonic() public {
        vm.prank(alice);  pool.stake(10_000 ether);

        uint256 acc0 = pool.accRewardPerToken();
        vm.prank(owner);  pool.pushRewards(100 ether);
        uint256 acc1 = pool.accRewardPerToken();
        vm.prank(owner);  pool.pushRewards(50 ether);
        uint256 acc2 = pool.accRewardPerToken();

        assertGt(acc1, acc0);
        assertGt(acc2, acc1);
    }

    // -------------------------------------------------------------
    // claim()
    // -------------------------------------------------------------

    function test_Claim_PaysOutPending() public {
        vm.prank(alice);  pool.stake(10_000 ether);
        vm.prank(owner);  pool.pushRewards(750 ether);

        uint256 walletBefore = token.balanceOf(alice);
        vm.prank(alice);  pool.claim();
        uint256 walletAfter = token.balanceOf(alice);

        assertEq(walletAfter - walletBefore, 750 ether);
        assertEq(pool.pending(alice), 0);
    }

    function test_Claim_NoPending_NoTransfer() public {
        vm.prank(alice);  pool.stake(10_000 ether);
        // no rewards pushed
        uint256 walletBefore = token.balanceOf(alice);
        vm.prank(alice);  pool.claim();
        uint256 walletAfter = token.balanceOf(alice);
        assertEq(walletAfter, walletBefore);
    }

    function test_Claim_IsIdempotent() public {
        vm.prank(alice);  pool.stake(10_000 ether);
        vm.prank(owner);  pool.pushRewards(500 ether);

        vm.prank(alice);  pool.claim();
        vm.prank(alice);  pool.claim();
        // second claim is no-op (pending was already paid)
        assertEq(pool.pending(alice), 0);
    }

    // -------------------------------------------------------------
    // withdraw()
    // -------------------------------------------------------------

    function test_Withdraw_FullBalance_PaysPending() public {
        vm.prank(alice);  pool.stake(10_000 ether);
        vm.prank(owner);  pool.pushRewards(500 ether);

        uint256 walletBefore = token.balanceOf(alice);
        vm.prank(alice);  pool.withdraw(10_000 ether);
        uint256 walletAfter = token.balanceOf(alice);

        // expected delta: +10_000 (principal) +500 (reward) = +10_500
        assertEq(walletAfter - walletBefore, 10_500 ether);
        assertEq(pool.balanceOf(alice), 0);
        assertEq(pool.totalStaked(), 0);
        assertFalse(pool.isStaker(alice));
    }

    function test_Withdraw_Partial_PaysAllPending() public {
        vm.prank(alice);  pool.stake(10_000 ether);
        vm.prank(owner);  pool.pushRewards(500 ether);

        uint256 walletBefore = token.balanceOf(alice);
        vm.prank(alice);  pool.withdraw(4_000 ether);
        uint256 walletAfter = token.balanceOf(alice);

        // delta: +4_000 (principal) +500 (pending paid IN FULL on any state change) = +4_500
        assertEq(walletAfter - walletBefore, 4_500 ether);
        assertEq(pool.balanceOf(alice), 6_000 ether);
        assertEq(pool.pending(alice), 0);
    }

    function test_Withdraw_RevertsOnInsufficient() public {
        vm.prank(alice);  pool.stake(1_000 ether);
        vm.prank(alice);
        vm.expectRevert("VRS: insufficient balance");
        pool.withdraw(2_000 ether);
    }

    function test_Withdraw_RevertsOnZero() public {
        vm.prank(alice);
        vm.expectRevert("VRS: zero amount");
        pool.withdraw(0);
    }

    function test_Withdraw_NobodyCanWithdrawWithoutStaking() public {
        vm.prank(nobody);
        vm.expectRevert("VRS: insufficient balance");
        pool.withdraw(1 ether);
    }

    // -------------------------------------------------------------
    // End-to-end multi-staker scenario
    // -------------------------------------------------------------

    function test_E2E_ThreeStakers_TwoPushes_MidJoinerAndExiter() public {
        // alice 20k, bob 30k → first push 100, then bob withdraws, then carol joins 50k, second push 100
        vm.prank(alice);  pool.stake(20_000 ether);
        vm.prank(bob);    pool.stake(30_000 ether);

        // push 1: 100 over (20k+30k) → alice 40, bob 60
        vm.prank(owner);  pool.pushRewards(100 ether);
        assertEq(pool.pending(alice), 40 ether);
        assertEq(pool.pending(bob),   60 ether);

        // bob withdraws his entire 30k → claims 60 pending in same tx
        uint256 bobWalletBefore = token.balanceOf(bob);
        vm.prank(bob);  pool.withdraw(30_000 ether);
        uint256 bobWalletAfter = token.balanceOf(bob);
        assertEq(bobWalletAfter - bobWalletBefore, 30_060 ether);
        assertEq(pool.balanceOf(bob), 0);

        // carol stakes 50k. Now totalStaked = 20k (alice) + 50k (carol) = 70k.
        vm.prank(carol);  pool.stake(50_000 ether);

        // push 2: 100 over (20k + 50k) → alice += 100 * 20/70, carol += 100 * 50/70
        vm.prank(owner);  pool.pushRewards(100 ether);

        // alice total pending = 40 (from push1, not yet claimed) + ~28.57 (from push2)
        // 100 * 20e18 / 70e18 = 28571428571428571428 wei = ~28.571 ether
        //
        // MasterChef-style accumulator floors `(amount * 1e18) / totalStaked` per push,
        // so per user we under-pay by up to (totalStaked - 1) * balance / 1e18 wei
        // per push. With totalStaked = 70_000e18 and balance ~50k, dust is up to ~50_000 wei.
        // Allow 100k wei tolerance to cover that across N pushes.
        uint256 DUST = 100_000;

        uint256 alicePending = pool.pending(alice);
        assertApproxEqAbs(alicePending, 40 ether + 28_571428571428571428, DUST);

        uint256 carolPending = pool.pending(carol);
        assertApproxEqAbs(carolPending, 71_428571428571428571, DUST);

        // bob is OUT — he gets nothing from push 2
        assertEq(pool.pending(bob), 0);
    }

    // -------------------------------------------------------------
    // Solvency invariant
    // -------------------------------------------------------------

    /// @dev After any sequence of operations the contract must hold AT LEAST
    ///      totalStaked + sum(pending) tokens. Use a sample sequence to verify.
    function test_Invariant_ContractHoldsAtLeastStakedPlusPending() public {
        vm.prank(alice);  pool.stake(10_000 ether);
        vm.prank(bob);    pool.stake(20_000 ether);
        vm.prank(owner);  pool.pushRewards(123 ether);
        vm.prank(carol);  pool.stake(15_000 ether);
        vm.prank(owner);  pool.pushRewards(456 ether);
        vm.prank(alice);  pool.withdraw(2_000 ether);
        vm.prank(owner);  pool.pushRewards(789 ether);

        uint256 contractBalance = token.balanceOf(address(pool));
        uint256 sumPending = pool.pending(alice) + pool.pending(bob) + pool.pending(carol);
        uint256 expected = pool.totalStaked() + sumPending;

        // contract balance >= expected (any excess is rounding dust, fine)
        assertGe(contractBalance, expected);
        // The dust per push is bounded by totalStaked / 1e18 wei. We did 3 pushes over
        // pools of ~30-45k tokens, so worst-case dust ~135k wei. Allow a 1M wei ceiling
        // for safety — this is sub-1e-12 of a single token, the classic MasterChef floor.
        assertLt(contractBalance - expected, 1_000_000);
    }
}
