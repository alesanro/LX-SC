const jobControllerFlagsFunc = require('../common/jobControllerFlags')
const activeAccounts = require('./accounts.json').accounts
const wallet = require('../wallet.json')

const Roles2Library = artifacts.require("Roles2Library")
const BoardController = artifacts.require("BoardController")
const UserRegistry = artifacts.require("UserRegistry")
const UserFactory = artifacts.require("UserFactory")
const UserInterface = artifacts.require("UserInterface")
const Recovery = artifacts.require("Recovery")

const OWNER_ADDRESS = "0xfebc7d461b970516c6d3629923c73cc6475f1d13"

function getAccount() {
	return new Promise((resolve, reject) => {
		web3.eth.getAccounts((e, accounts) => (e === null || e === undefined) ? resolve(accounts[0]) : reject)
	})
}

module.exports = async (callback) => {
	const account = await getAccount()
	if (OWNER_ADDRESS !== account) {
		return callback(`Invalid owner address to make mass ETH transfer. Expect "${OWNER_ADDRESS}", have "${account}".`)
	}

	const jobControllerFlags = jobControllerFlagsFunc(web3)
	
	const roles2Library = await Roles2Library.deployed()
	const boardController = await BoardController.deployed()
	const userFactory = await UserFactory.deployed()
	const userRegistry = await UserRegistry.deployed()
	const recovery = await Recovery.deployed()

	console.log(roles2Library.address)

	// add another user as a root user
	console.log(`Add user ${activeAccounts.admin} as root user ${await roles2Library.setRootUser(activeAccounts.admin, true)}`)

	// print signatures for board communication functions 
	console.log(await boardController.contract.createBoard.getData(0,0,0,0).slice(0,10))
	console.log(await boardController.contract.closeBoard.getData(0).slice(0,10))

	// setup moderator role access to board functionality
	console.log(`Add role capability boardController.createBoard ${await roles2Library.addRoleCapability(jobControllerFlags.roles.moderator, boardController.address, "0x1d132702")}`)
	console.log(`Add role capability boardController.closeBoard. ${await roles2Library.addRoleCapability(jobControllerFlags.roles.moderator, boardController.address, "0x210c1f29")}`)

	// print signatures for user manipulation functions 
	console.log(await userFactory.contract.createUserWithProxyAndRecovery.getData(0x0, false).slice(0,10))
	console.log(await recovery.contract.recoverUser.getData(0x0, 0x0).slice(0,10))

	// setup moderator role access to user functionality
	console.log(`Add role capability ${await roles2Library.addRoleCapability(jobControllerFlags.roles.moderator, userFactory.address, "0x5be62401")}`)
	console.log(`Add role capability ${await roles2Library.addRoleCapability(jobControllerFlags.roles.moderator, recovery.address, "0x722c1809")}`)

	// create moderator account
	{
		const moderator = activeAccounts.moderators[0]
		console.log(`User created for ${moderator}: ${await userFactory.createUserWithProxyAndRecovery(moderator, false)}`)
		console.log(`- created address: ${await userRegistry.getUserContracts(moderator)}`)
		console.log(`\n`)
	
		const moderatorRouter = UserInterface.at((await userRegistry.getUserContracts(moderator))[0])
		const moderatorProxy = await moderatorRouter.getUserProxy()
		console.log(`Add address ${moderatorProxy} to moderator role for user ${moderator}: ${await roles2Library.addUserRole(moderatorProxy, jobControllerFlags.roles.moderator)}`)
	}

	callback()
}