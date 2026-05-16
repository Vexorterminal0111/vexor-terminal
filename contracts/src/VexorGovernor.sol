// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/// @title  VexorGovernor — simple on-chain governance over $VEXOR
/// @notice OpenZeppelin Governor with $VEXOR (ERC20Votes) voting weight.
///         Testnet-tuned timings:
///           - Voting delay:  1 block (instant)
///           - Voting period: 7200 blocks (~4 hours on Base @ 2s blocks)
///           - Proposal threshold: 100 $VEXOR
///           - Quorum: 4% of total supply
///         Proposals execute directly (no timelock) to keep the demo simple.
contract VexorGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction
{
    constructor(IVotes _token)
        Governor("VexorGovernor")
        GovernorSettings(
            1,          // votingDelay in blocks
            7200,       // votingPeriod in blocks (~4h on Base @ 2s)
            100 ether   // proposalThreshold ($VEXOR)
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4) // 4%
    {}

    // --------- Required overrides (OZ v5) ---------

    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }
}
