"use strict";

const UserBackend = artifacts.require("UserBackend")
const UserRegistry = artifacts.require("UserRegistry")
const UserBackendProvider = artifacts.require("UserBackendProvider")

module.exports = deployer => {
	deployer.then(async () => {
		const backendProvider = await UserBackendProvider.deployed()
		await backendProvider.setUserBackend(UserBackend.address)
		await backendProvider.setUserRegistry(UserRegistry.address)

		console.log("[Migration] UserBackendProvider #initialized")
	})
}