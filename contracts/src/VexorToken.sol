// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title  VexorToken — $VEXOR
/// @notice ERC-20 utility/governance token for the Vexor Terminal protocol.
///         Testnet build: supports a public `claim()` faucet (1000 $VEXOR per address)
///         so anyone with a wallet can exercise staking + governance on Base Sepolia.
///         The owner can mint additional supply for liquidity / staking rewards.
///         On mainnet, faucet + owner-mint will be removed in the immutable launch
///         build; the testnet build is intentionally permissive for demo purposes.
contract VexorToken is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes, Ownable {
    /// @dev Per-address one-time faucet drop on testnet.
    uint256 public constant FAUCET_AMOUNT = 1000 ether;

    mapping(address => bool) public hasClaimed;

    event FaucetClaim(address indexed account, uint256 amount);

    constructor(address initialOwner)
        ERC20("Vexor", "VEXOR")
        ERC20Permit("Vexor")
        Ownable(initialOwner)
    {
        // Initial treasury mint to the deployer for seeding staking rewards
        // and governance test proposals. 10_000_000 $VEXOR on testnet.
        _mint(initialOwner, 10_000_000 ether);
    }

    /// @notice Anyone can claim a one-time faucet drop of $VEXOR on testnet.
    function claim() external {
        require(!hasClaimed[msg.sender], "VEXOR: already claimed");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaim(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner can mint additional supply (e.g. to top up staking rewards).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // ---------------------------------------------------------------------
    // ERC20Votes / ERC20Permit / Nonces required overrides (OZ v5)
    // ---------------------------------------------------------------------

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
