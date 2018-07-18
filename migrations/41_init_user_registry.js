"use strict";

const UserRegistry = artifacts.require("UserRegistry")
const Roles2Library = artifacts.require("Roles2Library")
const StorageManager = artifacts.require("StorageManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")

module.exports = deployer => {
	deployer.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(UserRegistry.address, "UserRegistry")

		const userRegistry = await UserRegistry.deployed()
		const history = await MultiEventsHistory.deployed()

		await userRegistry.setupEventsHistory(history.address)
		await history.authorize(userRegistry.address)

		console.log("[Migration] UserRegistry #init")
	})
}