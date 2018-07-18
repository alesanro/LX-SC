"use strict";
const BoardController = artifacts.require('./BoardController.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');
const Recovery = artifacts.require('Recovery')
const UserFactory = artifacts.require('UserFactory')
const UserRegistry = artifacts.require('UserRegistry')

module.exports = deployer => {
    deployer.then(async () => {
        const boardController = await BoardController.deployed();
        const roles2Library = await Roles2Library.deployed();
        const recovery = await Recovery.deployed();
        const userRegistry = await UserRegistry.deployed()
        const userFactory = await UserFactory.deployed()

        const Roles = {
            MODERATOR_ROLE: 10,
            USER_REGISTRY_ROLE: 11,
        }

        const createBoardSig = boardController.contract.createBoard.getData(0,0,0,0).slice(0,10);
        const closeBoardSig = boardController.contract.closeBoard.getData(0).slice(0,10);
        const recoverUserSig = recovery.contract.recoverUser.getData(0x0, 0x0).slice(0,10);

        await roles2Library.addRoleCapability(Roles.MODERATOR_ROLE, BoardController.address, createBoardSig);
        await roles2Library.addRoleCapability(Roles.MODERATOR_ROLE, BoardController.address, closeBoardSig);
        await roles2Library.addRoleCapability(Roles.MODERATOR_ROLE, Recovery.address, recoverUserSig);

        // NOTE: HERE!!!! RIGHTS SHOULD BE GRANTED TO UserFactory TO ACCESS UserRegistry CONTRACT MODIFICATION
		{
			await roles2Library.addUserRole(userFactory.address, Roles.USER_REGISTRY_ROLE)
			{
				const sig = userRegistry.contract.addUserContract.getData(0x0).slice(0,10)
				await roles2Library.addRoleCapability(Roles.USER_REGISTRY_ROLE, userRegistry.address, sig)
			}
		}

        console.log("[Migration] Moderator Role #setup")
	})
};
