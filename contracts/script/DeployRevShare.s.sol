// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VexorRevShare} from "../src/VexorRevShare.sol";

/// @notice Deploys VexorRevShare against an existing ERC-20 staking token.
///
/// Required env vars (set BEFORE running):
///   DEPLOYER_PRIVATE_KEY    — hex private key for the deployer EOA (must have ETH on the target chain)
///   STAKING_TOKEN_ADDRESS   — ERC-20 to stake (Base mainnet $VT = 0x2c684D666998436634EcEde1527EdA7975427Ba3)
///   INITIAL_OWNER           — address that will own the deployed pool (recommend a multisig)
///
/// Usage:
///   forge script script/DeployRevShare.s.sol \
///     --rpc-url base \
///     --broadcast \
///     --verify \
///     --etherscan-api-key $BASESCAN_API_KEY
contract DeployRevShare is Script {
    function run() external {
        uint256 deployerPk      = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address stakingToken    = vm.envAddress("STAKING_TOKEN_ADDRESS");
        address initialOwner    = vm.envAddress("INITIAL_OWNER");

        require(stakingToken  != address(0), "STAKING_TOKEN_ADDRESS missing");
        require(initialOwner  != address(0), "INITIAL_OWNER missing");

        address deployer = vm.addr(deployerPk);

        console2.log("============================================================");
        console2.log("VexorRevShare deployment");
        console2.log("============================================================");
        console2.log("Chain ID         :", block.chainid);
        console2.log("Deployer EOA     :", deployer);
        console2.log("Staking token    :", stakingToken);
        console2.log("Initial owner    :", initialOwner);
        console2.log("============================================================");

        vm.startBroadcast(deployerPk);

        VexorRevShare pool = new VexorRevShare(IERC20(stakingToken), initialOwner);

        vm.stopBroadcast();

        console2.log("VexorRevShare    :", address(pool));
        console2.log("Verify with:");
        console2.log("  forge verify-contract \\");
        console2.log("    --chain base \\");
        console2.log("    --etherscan-api-key $BASESCAN_API_KEY \\");
        console2.log("    --constructor-args $(cast abi-encode 'constructor(address,address)' STAKING_TOKEN INITIAL_OWNER) \\");
        console2.log("    POOL_ADDRESS src/VexorRevShare.sol:VexorRevShare");
    }
}
