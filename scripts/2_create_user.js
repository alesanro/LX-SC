const UserRegistry = artifacts.require("UserRegistry")
const UserFactory = artifacts.require("UserFactory")
const UserInterface = artifacts.require("UserInterface")

module.exports = async (callback) => {
	const userFactory = await UserFactory.deployed()
	const userRegistry = await UserRegistry.deployed()

	const accountAddress = process.argv[process.argv.length - 1];
	if (!web3.isAddress(accountAddress)) {
		return callback(`Invalid address option "${accountAddress}"`)
	}

	console.log(`User created for ${accountAddress}: ${await userFactory.createUserWithProxyAndRecovery(accountAddress, false)}`)
	const routerAddresses = await userRegistry.getUserContracts(accountAddress)
	console.log(`- created address: ${routerAddresses}`)

	var routerProxies = []
	for (const routerAddress of routerAddresses) {
		routerProxies.push(await UserInterface.at(routerAddress).getUserProxy())
	}

	console.log(`- use to bind address: ${routerProxies}`)
	console.log(`\n`)

	callback()
}