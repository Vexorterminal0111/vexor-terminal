// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title  VexorRevShare — flat single-sided $VT staking with manual pro-rata reward push.
/// @notice Stakers deposit $VT and become entitled to a pro-rata share of any rewards the
///         owner pushes via `pushRewards(amount)`. Rewards are distributed instantly using
///         the MasterChef-style accumulator (`accRewardPerToken`). No lock period, no tier
///         multipliers, withdraw any time. Reward token equals the staking token.
///
///         Accounting (per address):
///           pending = balance * accRewardPerToken / 1e18 - rewardDebt
///         After any state change that affects `balance`, `rewardDebt` is reset to
///         `balance * accRewardPerToken / 1e18` so future pending starts from zero
///         relative to the current accumulator.
///
///         Reward token == staking token, so the contract's internal accounting tracks
///         `totalStaked` separately from `stakingToken.balanceOf(this)`. The delta is
///         claimable rewards. The owner CANNOT withdraw arbitrary tokens — all $VT sent
///         to this contract via `pushRewards` becomes locked-in rewards for stakers.
contract VexorRevShare is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The token users stake AND receive rewards in (single-sided design).
    IERC20 public immutable stakingToken;

    /// @notice Fixed-point precision for the reward accumulator.
    uint256 public constant ACC_PRECISION = 1e18;

    /// @notice Sum of (reward * 1e18 / totalStaked) across every successful `pushRewards`.
    uint256 public accRewardPerToken;

    /// @notice Sum of all staked principal across all users (excludes pending rewards).
    uint256 public totalStaked;

    /// @notice Principal staked by each address (excludes pending rewards).
    mapping(address => uint256) public balanceOf;

    /// @notice `rewardDebt[user] = balance * accRewardPerToken / 1e18` at last interaction.
    mapping(address => uint256) public rewardDebt;

    event Staked(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event Claimed(address indexed user, uint256 reward);
    event RewardsPushed(address indexed from, uint256 amount, uint256 newAcc);

    constructor(IERC20 _stakingToken, address initialOwner) Ownable(initialOwner) {
        require(address(_stakingToken) != address(0), "VRS: zero token");
        stakingToken = _stakingToken;
    }

    // ---------------------------------------------------------------------
    // External — stakers
    // ---------------------------------------------------------------------

    /// @notice Stake `amount` of the staking token. Any pending rewards are auto-claimed
    ///         to the caller before the new principal is added.
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "VRS: zero amount");

        _settle(msg.sender);

        balanceOf[msg.sender] += amount;
        totalStaked += amount;
        rewardDebt[msg.sender] = (balanceOf[msg.sender] * accRewardPerToken) / ACC_PRECISION;

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount, balanceOf[msg.sender]);
    }

    /// @notice Withdraw `amount` of staked principal. Any pending rewards are auto-claimed
    ///         to the caller before principal is returned. `amount` can be the full balance.
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "VRS: zero amount");
        require(balanceOf[msg.sender] >= amount, "VRS: insufficient balance");

        _settle(msg.sender);

        balanceOf[msg.sender] -= amount;
        totalStaked -= amount;
        rewardDebt[msg.sender] = (balanceOf[msg.sender] * accRewardPerToken) / ACC_PRECISION;

        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, balanceOf[msg.sender]);
    }

    /// @notice Claim pending rewards without touching the principal.
    function claim() external nonReentrant {
        _settle(msg.sender);
        rewardDebt[msg.sender] = (balanceOf[msg.sender] * accRewardPerToken) / ACC_PRECISION;
    }

    // ---------------------------------------------------------------------
    // External — owner
    // ---------------------------------------------------------------------

    /// @notice Push `amount` of reward tokens, distributing them pro-rata to current stakers.
    /// @dev    Caller (the owner) must approve this contract for `amount` of `stakingToken`
    ///         before calling. Reverts if there are no stakers — the owner should wait until
    ///         at least one address has staked. Increments the global `accRewardPerToken`
    ///         accumulator; all current stakers see their `pending(addr)` rise immediately.
    function pushRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "VRS: zero amount");
        require(totalStaked > 0, "VRS: no stakers");

        accRewardPerToken += (amount * ACC_PRECISION) / totalStaked;

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardsPushed(msg.sender, amount, accRewardPerToken);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Pending (unclaimed) reward for `user` at the current accumulator value.
    function pending(address user) external view returns (uint256) {
        return _pending(user);
    }

    /// @notice True if `user` has any staked principal.
    function isStaker(address user) external view returns (bool) {
        return balanceOf[user] > 0;
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _pending(address user) internal view returns (uint256) {
        return (balanceOf[user] * accRewardPerToken) / ACC_PRECISION - rewardDebt[user];
    }

    /// @dev Pay out pending rewards (if any) without resetting rewardDebt. The caller
    ///      is responsible for updating rewardDebt after the post-state balance is set.
    function _settle(address user) internal {
        if (balanceOf[user] == 0) return;
        uint256 owed = _pending(user);
        if (owed > 0) {
            stakingToken.safeTransfer(user, owed);
            emit Claimed(user, owed);
        }
    }
}
