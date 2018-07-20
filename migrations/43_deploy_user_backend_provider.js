"use strict";

const UserBackendProvider = artifacts.require("UserBackendProvider")
const Roles2Library = artifacts.require("Roles2Library")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(UserBackendProvider, Roles2Library.address)

		console.log("[Migration] UserBackendProvider #deployed")
	})
}