"use strict";

const UserRegistry = artifacts.require("UserRegistry")
const Roles2Library = artifacts.require("Roles2Library")
const Storage = artifacts.require("Storage")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(UserRegistry, Storage.address, "UserRegistry", Roles2Library.address)

		console.log("[Migration] UserRegistry #deployed")
	})
}