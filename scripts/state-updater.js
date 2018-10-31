const jobControllerFlagsFunc = require('../common/jobControllerFlags')

const ROLES = {
    ADMIN: "admin",
    MODERATOR: "moderator",
    WORKER: "worker",
    CLIENT: "client",
    DEPLOYER: "deployer",
}

module.exports = {
    StateUpdater,
    ROLES,
    getNetworkId,
};

function getNetworkId(web3) {
    return new Promise((resolve, reject) => {
        web3.version.getNetwork((e, network) => (e === undefined || e === null) ? resolve(parseInt(network)) : reject(e));
    });
}

function StateUpdater(web3, artifacts, secrets) {
    this.web3 = web3
    this.artifacts = artifacts
    this.roles = secrets.roles
    this.jobControllerFlags = jobControllerFlagsFunc(web3)
    this.networkId
}

StateUpdater.prototype.initialize = async function () {
    this.networkId = await getNetworkId(this.web3);
}

StateUpdater.prototype.presetupRolesAccess = async function () {
  const Roles2Library = this.artifacts.require("Roles2Library")
  const BoardController = this.artifacts.require("BoardController")
  const UserFactory = this.artifacts.require("UserFactory")
  const Recovery = this.artifacts.require("Recovery")

  const roles2Library = await Roles2Library.deployed()
  const boardController = await BoardController.deployed()
  const userFactory = await UserFactory.deployed()
  const recovery = await Recovery.deployed()
  
  const admin = this.getAddressesForRole(ROLES.ADMIN)[0];

  // setup moderator role access to board functionality
  const boardControllerCreateBoardSig = boardController.contract.createBoard.getData(0,0,0,0).slice(0,10);
  await roles2Library.addRoleCapability(this.jobControllerFlags.roles.moderator, boardController.address, boardControllerCreateBoardSig, { from: admin, })
  console.log(`Add role capability boardController.createBoard (${boardControllerCreateBoardSig})`)
  
  const boardControllerCloseBoardSig = boardController.contract.closeBoard.getData(0).slice(0,10);
  await roles2Library.addRoleCapability(this.jobControllerFlags.roles.moderator, boardController.address, boardControllerCloseBoardSig, { from: admin, })
	console.log(`Add role capability boardController.closeBoard (${boardControllerCloseBoardSig})`)


  // setup moderator role access to user functionality
  const userFactoryCreateUserSig = userFactory.contract.createUserWithProxyAndRecovery.getData(0x0, false).slice(0,10);
  await roles2Library.addRoleCapability(this.jobControllerFlags.roles.moderator, userFactory.address, userFactoryCreateUserSig, { from: admin, })
  console.log(`Add role capability userFactory.createUserWithProxyAndRecovery (${userFactoryCreateUserSig})`)

  const recoveryUserRecoverSig = recovery.contract.recoverUser.getData(0x0, 0x0).slice(0,10);
  await roles2Library.addRoleCapability(this.jobControllerFlags.roles.moderator, recovery.address, recoveryUserRecoverSig, { from: admin, })
	console.log(`Add role capability recovery.recoverUser (${recoveryUserRecoverSig})`)

	// create moderator account
	for (const moderatorAddress of this.getAddressesForRole(ROLES.MODERATOR)) {
    const moderatorProxy = await this.createUser(moderatorAddress);
    await roles2Library.addUserRole(moderatorProxy, this.jobControllerFlags.roles.moderator, { from: admin, })
    console.info(`Account
      ${moderatorAddress}
        add ${moderatorProxy} 
          as MODERATOR
    `)
	}
}

StateUpdater.prototype.setRootAddresses = async function () {
  const Roles2Library = this.artifacts.require("Roles2Library");

  const rolesLibrary = await Roles2Library.deployed();
  const deployerAddress = this.getAddressesForRole(ROLES.DEPLOYER)[0];
  
  for (const adminAddress of this.getAddressesForRole(ROLES.ADMIN)) {
      await rolesLibrary.setRootUser(adminAddress, true, { from: deployerAddress });
      console.info(`Setup root
        ${adminAddress}
      `)
  }
}

StateUpdater.prototype.createUser = async function (accountAddress) {
  const UserRegistry = this.artifacts.require("UserRegistry")
  const UserFactory = this.artifacts.require("UserFactory")
  const UserInterface = this.artifacts.require("UserInterface")
  
  const userFactory = await UserFactory.deployed()
	const userRegistry = await UserRegistry.deployed()

	if (!this.web3.isAddress(accountAddress)) {
		throw new Error(`Invalid address option "${accountAddress}"`);
	}

  await userFactory.createUserWithProxyAndRecovery(accountAddress, false)
    
	const routerAddresses = await userRegistry.getUserContracts(accountAddress)

	var routerProxies = []
	for (const routerAddress of routerAddresses) {
		routerProxies.push(await UserInterface.at(routerAddress).getUserProxy.call())
  }
  
  const createdRouterAddress = routerAddresses[routerAddresses.length - 1];
  const createdRouterProxyAddress = routerProxies[routerAddresses.length - 1];

  console.info(`User created
    for account ${accountAddress}
      router: ${createdRouterAddress}
      proxy:  ${createdRouterProxyAddress}
  `)
  
  return createdRouterProxyAddress;
}

StateUpdater.prototype.setupFirstBoard = async function () {
    // load artifacts
    const BoardController = this.artifacts.require("BoardController");
    const UserRegistry = this.artifacts.require("UserRegistry")
    const UserInterface = this.artifacts.require("UserInterface")

    const userRegistry = await UserRegistry.deployed()
    const boardController = await BoardController.deployed();

    // main code
    if (await boardController.isBoardExists.call(1)) {
      console.warn(`Board with ID=1 is already exist. Skip.`);
      return;
    }

    const moderator = this.getAddressesForRole(ROLES.MODERATOR)[0]
    const users = await userRegistry.getUserContracts.call(moderator)
    const user = await UserInterface.at(users[users.length - 1])

    await user.forward(boardController.address, boardController.contract.createBoard.getData(1,1,1,'QmXspTuTXQSyQR4THkFeyDoYPtWXDt1JgadkbHGP3pswCM'), 0, true, { from: moderator, });

    if (await boardController.isBoardExists.call(1)) {
      console.info(`Board with ID=1 created successfully.`);
    }
    else {
      console.error(`Board creation failed.`);
    }
}

StateUpdater.prototype.getAddressesForRole = function(role) {
    let addresses = []

    for (const addressIdx of this.roles[role]) {
        if (this.web3.currentProvider instanceof this.web3.providers.HttpProvider ||
            this.networkId > 1000
        ) {
            addresses.push(this.web3.personal.listAccounts[addressIdx]);
        }
        else {
            addresses.push(this.web3.currentProvider.getAddress(addressIdx));
        }
    }

    return addresses
}