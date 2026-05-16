// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {VexorToken} from "../src/VexorToken.sol";
import {VexorStaking} from "../src/VexorStaking.sol";
import {VexorGovernor} from "../src/VexorGovernor.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

contract VexorTokenTest is Test {
    VexorToken internal token;
    address internal owner = address(0xA11CE);
    address internal alice = address(0xBEEF);
    address internal bob   = address(0xCAFE);

    function setUp() public {
        vm.prank(owner);
        token = new VexorToken(owner);
    }

    function test_InitialMintToOwner() public view {
        assertEq(token.balanceOf(owner), 10_000_000 ether);
        assertEq(token.totalSupply(), 10_000_000 ether);
    }

    function test_FaucetClaim() public {
        vm.prank(alice);
        token.claim();
        assertEq(token.balanceOf(alice), 1000 ether);
        assertTrue(token.hasClaimed(alice));
    }

    function test_FaucetClaim_DoubleReverts() public {
        vm.prank(alice);
        token.claim();
        vm.prank(alice);
        vm.expectRevert("VEXOR: already claimed");
        token.claim();
    }

    function test_OwnerMint() public {
        vm.prank(owner);
        token.mint(bob, 500 ether);
        assertEq(token.balanceOf(bob), 500 ether);
    }

    function test_DelegationActivatesVotes() public {
        vm.prank(alice);
        token.claim();
        // delegate to self
        vm.prank(alice);
        token.delegate(alice);
        // need to advance one block before clock snapshot is updated
        vm.roll(block.number + 1);
        assertEq(token.getVotes(alice), 1000 ether);
    }
}

contract VexorStakingTest is Test {
    VexorToken internal token;
    VexorStaking internal staking;
    address internal owner = address(0xA11CE);
    address internal alice = address(0xBEEF);

    function setUp() public {
        vm.prank(owner);
        token = new VexorToken(owner);
        vm.prank(owner);
        staking = new VexorStaking(token, owner);

        // owner funds rewards: 100_000 VEXOR over 10 days
        vm.startPrank(owner);
        token.transfer(address(staking), 100_000 ether);
        staking.notifyRewards(100_000 ether, 10 days);
        vm.stopPrank();

        // give alice 5000 VEXOR
        vm.prank(owner);
        token.transfer(alice, 5000 ether);
    }

    function test_StakeAndWithdrawAfterLock() public {
        vm.startPrank(alice);
        token.approve(address(staking), 5000 ether);
        uint256 pid = staking.stake(1000 ether, VexorStaking.LockTier.Thirty);
        vm.stopPrank();

        // fast forward past lock
        vm.warp(block.timestamp + 30 days + 1);

        vm.prank(alice);
        staking.withdraw(pid);
        assertGt(token.balanceOf(alice), 5000 ether); // got rewards + principal back
    }

    function test_WithdrawBeforeLockReverts() public {
        vm.startPrank(alice);
        token.approve(address(staking), 5000 ether);
        uint256 pid = staking.stake(1000 ether, VexorStaking.LockTier.Thirty);
        vm.expectRevert("VST: locked");
        staking.withdraw(pid);
        vm.stopPrank();
    }

    function test_HigherTierEarnsMore() public {
        vm.startPrank(alice);
        token.approve(address(staking), 5000 ether);
        uint256 lowTierPid = staking.stake(1000 ether, VexorStaking.LockTier.Thirty);
        uint256 highTierPid = staking.stake(1000 ether, VexorStaking.LockTier.ThreeSixtyFive);
        vm.stopPrank();

        // accrue 1 day of rewards
        vm.warp(block.timestamp + 1 days);

        uint256 lowPending = staking.pending(lowTierPid);
        uint256 highPending = staking.pending(highTierPid);
        // 3x multiplier should yield ~3x rewards
        assertApproxEqRel(highPending, lowPending * 3, 0.01e18);
    }
}

contract VexorGovernorTest is Test {
    VexorToken internal token;
    VexorGovernor internal gov;
    address internal owner = address(0xA11CE);
    address internal alice = address(0xBEEF);

    function setUp() public {
        vm.prank(owner);
        token = new VexorToken(owner);
        vm.prank(owner);
        gov = new VexorGovernor(token);

        // give alice 500_000 VEXOR (> 4% quorum of 10M = 400k)
        vm.prank(owner);
        token.transfer(alice, 500_000 ether);

        vm.prank(alice);
        token.delegate(alice);
        vm.roll(block.number + 1);
    }

    function test_ProposeAndVote() public {
        address[] memory targets = new address[](1);
        targets[0] = address(token);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("mint(address,uint256)", alice, 1 ether);

        vm.prank(alice);
        uint256 pid = gov.propose(targets, values, calldatas, "Mint 1 VEXOR to alice");

        // voting delay = 1 block
        vm.roll(block.number + 2);
        assertEq(uint8(gov.state(pid)), uint8(IGovernor.ProposalState.Active));

        vm.prank(alice);
        gov.castVote(pid, 1); // For

        // skip past voting period (7200 blocks)
        vm.roll(block.number + 7201);

        assertEq(uint8(gov.state(pid)), uint8(IGovernor.ProposalState.Succeeded));
    }
}
