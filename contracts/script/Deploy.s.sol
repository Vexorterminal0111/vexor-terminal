// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {VexorToken} from "../src/VexorToken.sol";
import {VexorStaking} from "../src/VexorStaking.sol";
import {VexorGovernor} from "../src/VexorGovernor.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        VexorToken token = new VexorToken(deployer);
        VexorStaking staking = new VexorStaking(token, deployer);
        VexorGovernor governor = new VexorGovernor(token);

        // Seed staking rewards: 1M VEXOR over 30 days
        token.transfer(address(staking), 1_000_000 ether);
        staking.notifyRewards(1_000_000 ether, 30 days);

        vm.stopBroadcast();

        console2.log("Deployer:", deployer);
        console2.log("VexorToken:", address(token));
        console2.log("VexorStaking:", address(staking));
        console2.log("VexorGovernor:", address(governor));
    }
}
