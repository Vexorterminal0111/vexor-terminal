// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title  VexorStaking — lock-period staking with tiered reward multipliers
/// @notice Users stake $VEXOR for a fixed lock period and earn a pro-rata
///         share of the per-second reward emission, multiplied by their tier.
///         Tiers:
///           - 30  days → 1.0x weight
///           - 90  days → 1.5x weight
///           - 180 days → 2.0x weight
///           - 365 days → 3.0x weight
///         Reward token == stake token ($VEXOR). The owner funds rewards by
///         calling `notifyRewards(uint256 amount, uint256 duration)` after
///         transferring $VEXOR into this contract.
contract VexorStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum LockTier {
        Thirty,    // 30 days,  1.0x
        Ninety,    // 90 days,  1.5x
        OneEighty, // 180 days, 2.0x
        ThreeSixtyFive // 365 days, 3.0x
    }

    struct StakeInfo {
        uint128 amount;        // $VEXOR staked (raw)
        uint128 weighted;      // amount * tier multiplier (1e18 fixed)
        uint64  start;
        uint64  unlock;
        LockTier tier;
        uint256 rewardDebt;    // weighted * accRewardPerWeighted at last update
    }

    IERC20 public immutable stakingToken;

    /// @dev Per-tier multipliers in 1e4 fixed-point (10000 = 1.0x)
    uint256 public constant MULT_30  = 10_000;
    uint256 public constant MULT_90  = 15_000;
    uint256 public constant MULT_180 = 20_000;
    uint256 public constant MULT_365 = 30_000;
    uint256 public constant MULT_BPS = 10_000;

    /// @dev Reward accumulator. accRewardPerWeighted scaled by ACC_PRECISION.
    uint256 public constant ACC_PRECISION = 1e18;
    uint256 public accRewardPerWeighted;
    uint256 public lastUpdate;
    uint256 public rewardRatePerSecond;
    uint256 public rewardPeriodEnd;

    /// @dev Total weighted stake across all positions.
    uint256 public totalWeighted;

    /// @dev positionId => StakeInfo
    mapping(uint256 => StakeInfo) public positions;
    /// @dev positionId => owner
    mapping(uint256 => address) public ownerOf;
    /// @dev owner => positionIds[]
    mapping(address => uint256[]) public positionsOf;
    uint256 public nextPositionId;

    event Staked(
        address indexed user,
        uint256 indexed positionId,
        uint256 amount,
        LockTier tier,
        uint64 unlock
    );
    event Withdrawn(address indexed user, uint256 indexed positionId, uint256 amount);
    event Claimed(address indexed user, uint256 indexed positionId, uint256 reward);
    event RewardsNotified(uint256 amount, uint256 duration, uint256 endsAt);

    constructor(IERC20 _stakingToken, address initialOwner) Ownable(initialOwner) {
        stakingToken = _stakingToken;
    }

    // ---------------------------------------------------------------------
    // External
    // ---------------------------------------------------------------------

    function stake(uint256 amount, LockTier tier) external nonReentrant returns (uint256 positionId) {
        require(amount > 0, "VST: zero amount");
        _updateAccumulator();

        uint64 lockSecs = _lockSeconds(tier);
        uint256 mult = _multiplier(tier);
        uint256 weighted = (amount * mult) / MULT_BPS;

        positionId = nextPositionId++;
        positions[positionId] = StakeInfo({
            amount: uint128(amount),
            weighted: uint128(weighted),
            start: uint64(block.timestamp),
            unlock: uint64(block.timestamp + lockSecs),
            tier: tier,
            rewardDebt: (weighted * accRewardPerWeighted) / ACC_PRECISION
        });
        ownerOf[positionId] = msg.sender;
        positionsOf[msg.sender].push(positionId);
        totalWeighted += weighted;

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, positionId, amount, tier, uint64(block.timestamp + lockSecs));
    }

    function claim(uint256 positionId) external nonReentrant {
        require(ownerOf[positionId] == msg.sender, "VST: not owner");
        _updateAccumulator();
        StakeInfo storage pos = positions[positionId];

        uint256 pending = _pending(pos);
        if (pending > 0) {
            pos.rewardDebt = (uint256(pos.weighted) * accRewardPerWeighted) / ACC_PRECISION;
            stakingToken.safeTransfer(msg.sender, pending);
            emit Claimed(msg.sender, positionId, pending);
        }
    }

    function withdraw(uint256 positionId) external nonReentrant {
        require(ownerOf[positionId] == msg.sender, "VST: not owner");
        _updateAccumulator();
        StakeInfo storage pos = positions[positionId];
        require(block.timestamp >= pos.unlock, "VST: locked");
        require(pos.amount > 0, "VST: empty");

        uint256 pending = _pending(pos);
        uint256 amount = pos.amount;
        uint256 weighted = pos.weighted;

        totalWeighted -= weighted;
        pos.amount = 0;
        pos.weighted = 0;
        pos.rewardDebt = 0;

        if (pending > 0) {
            stakingToken.safeTransfer(msg.sender, pending);
            emit Claimed(msg.sender, positionId, pending);
        }
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, positionId, amount);
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    /// @notice Owner notifies the staking pool of additional rewards.
    /// @dev    The owner must first transfer `amount` of $VEXOR to this
    ///         contract. The reward will stream linearly over `duration`
    ///         seconds, extending the current period.
    function notifyRewards(uint256 amount, uint256 duration) external onlyOwner {
        require(duration > 0, "VST: zero duration");
        _updateAccumulator();

        uint256 leftover;
        if (block.timestamp < rewardPeriodEnd) {
            leftover = (rewardPeriodEnd - block.timestamp) * rewardRatePerSecond;
        }
        rewardRatePerSecond = (amount + leftover) / duration;
        rewardPeriodEnd = block.timestamp + duration;
        lastUpdate = block.timestamp;

        emit RewardsNotified(amount, duration, rewardPeriodEnd);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function pending(uint256 positionId) external view returns (uint256) {
        StakeInfo memory pos = positions[positionId];
        uint256 acc = accRewardPerWeighted;
        if (block.timestamp > lastUpdate && totalWeighted > 0) {
            uint256 endTime = block.timestamp < rewardPeriodEnd ? block.timestamp : rewardPeriodEnd;
            if (endTime > lastUpdate) {
                uint256 reward = (endTime - lastUpdate) * rewardRatePerSecond;
                acc += (reward * ACC_PRECISION) / totalWeighted;
            }
        }
        return ((uint256(pos.weighted) * acc) / ACC_PRECISION) - pos.rewardDebt;
    }

    function positionCountOf(address user) external view returns (uint256) {
        return positionsOf[user].length;
    }

    function positionIdAt(address user, uint256 index) external view returns (uint256) {
        return positionsOf[user][index];
    }

    function multiplierBps(LockTier tier) external pure returns (uint256) {
        return _multiplier(tier);
    }

    function lockSeconds(LockTier tier) external pure returns (uint64) {
        return _lockSeconds(tier);
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _updateAccumulator() internal {
        if (block.timestamp <= lastUpdate) return;
        if (totalWeighted == 0) {
            lastUpdate = block.timestamp;
            return;
        }
        uint256 endTime = block.timestamp < rewardPeriodEnd ? block.timestamp : rewardPeriodEnd;
        if (endTime > lastUpdate) {
            uint256 reward = (endTime - lastUpdate) * rewardRatePerSecond;
            accRewardPerWeighted += (reward * ACC_PRECISION) / totalWeighted;
        }
        lastUpdate = block.timestamp;
    }

    function _pending(StakeInfo storage pos) internal view returns (uint256) {
        return ((uint256(pos.weighted) * accRewardPerWeighted) / ACC_PRECISION) - pos.rewardDebt;
    }

    function _multiplier(LockTier tier) internal pure returns (uint256) {
        if (tier == LockTier.Thirty) return MULT_30;
        if (tier == LockTier.Ninety) return MULT_90;
        if (tier == LockTier.OneEighty) return MULT_180;
        return MULT_365;
    }

    function _lockSeconds(LockTier tier) internal pure returns (uint64) {
        if (tier == LockTier.Thirty) return 30 days;
        if (tier == LockTier.Ninety) return 90 days;
        if (tier == LockTier.OneEighty) return 180 days;
        return 365 days;
    }
}
