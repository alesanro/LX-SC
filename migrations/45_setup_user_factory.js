"use strict";

const UserFactory = artifacts.require("UserFactory")
const UserBackendProvider = artifacts.require("UserBackendProvider")

module.exports = (deployer, network, accounts) => {
	deployer.then(async () => {
		const userFactory = await UserFactory.deployed()
		await userFactory.setUserBackendProvider(UserBackendProvider.address)
		
		// NOTE: still need to setup oracle address to be able to create a user with user factory
		await userFactory.setOracleAddress(accounts[0])

		console.log("[Migration] UserFactory #setup")
	})
}