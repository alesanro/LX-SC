<<<<<<< HEAD
const RatingsAndReputationLibrary = artifacts.require('./RatingsAndReputationLibrary.sol');
const StorageInterface = artifacts.require('./StorageInterface.sol');
const UserLibraryMock = artifacts.require('./UserLibraryMock.sol');
const UserProxyTester = artifacts.require('./UserProxyTester.sol');
const StorageManager = artifacts.require('./StorageManager.sol');
const PaymentGateway = artifacts.require('./PaymentGateway.sol');
const PaymentProcessor = artifacts.require('./PaymentProcessor.sol');
=======
"use strict";

const BalanceHolder = artifacts.require('./BalanceHolder.sol');
const ERC20Library = artifacts.require('./ERC20Library.sol');
const FakeCoin = artifacts.require('./FakeCoin.sol');
const IPFSLibrary = artifacts.require('./IPFSLibrary.sol');
const JobController = artifacts.require('./JobController.sol');
const ManagerMock = artifacts.require('./ManagerMock.sol');
const Mock = artifacts.require('./Mock.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const PaymentGateway = artifacts.require('./PaymentGateway.sol');
const PaymentProcessor = artifacts.require('./PaymentProcessor.sol');
const RatingsAndReputationLibrary = artifacts.require('./RatingsAndReputationLibrary.sol');
const Recovery = artifacts.require('./Recovery.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');
>>>>>>> roles2
const SkillsLibrary = artifacts.require('./SkillsLibrary.sol');
const Storage = artifacts.require('./Storage.sol');
const StorageInterface = artifacts.require('./StorageInterface.sol');
const StorageManager = artifacts.require('./StorageManager.sol');
const StorageTester = artifacts.require('./StorageTester.sol');
const User = artifacts.require('./User.sol');
const UserFactory = artifacts.require('./UserFactory.sol');
const UserLibrary = artifacts.require('./UserLibrary.sol');
const UserLibraryMock = artifacts.require('./UserLibraryMock.sol');
const UserMock = artifacts.require('./UserMock.sol');
const UserProxy = artifacts.require('./UserProxy.sol');
const UserProxyTester = artifacts.require('./UserProxyTester.sol');

const owner = web3.eth.accounts[0];


module.exports = deployer => {
  deployer.deploy(ManagerMock)
  .then(() => deployer.deploy(Mock))
  .then(() => deployer.deploy(User, owner, Mock.address))
  .then(() => deployer.deploy(UserMock))
  .then(() => deployer.deploy(UserLibraryMock))
  .then(() => deployer.deploy(StorageManager, Mock.address))
  .then(() => deployer.deploy(BalanceHolder, Mock.address))
  .then(() => deployer.deploy(Recovery, Mock.address))
  .then(() => deployer.deploy(Storage))
  .then(() => deployer.deploy(StorageInterface))
  .then(() => deployer.link(StorageInterface, [StorageTester, UserLibrary]))
  .then(() => deployer.deploy(StorageTester, Storage.address, 'StorageTester'))
  .then(() => deployer.deploy(FakeCoin))
  .then(() => deployer.deploy(MultiEventsHistory, Mock.address))
  .then(() => deployer.deploy(UserProxy))
  .then(() => deployer.deploy(UserProxyTester))
<<<<<<< HEAD
  .then(() => deployer.deploy(UserFactory))
  .then(() => deployer.deploy(RatingsAndReputationLibrary, Storage.address, 'RatingsAndReputationLibrary'))
  .then(() => deployer.deploy(IPFSLibrary, Storage.address, 'IPFSLibrary'))
  .then(() => deployer.deploy(SkillsLibrary, Storage.address, 'SkillsLibrary'))
  .then(() => deployer.deploy(RolesLibrary, Storage.address, 'RolesLibrary'))
  .then(() => deployer.deploy(UserLibrary, Storage.address, 'UserLibrary'))
  .then(() => deployer.deploy(ERC20Library, Storage.address, 'ERC20Library'))
  .then(() => deployer.deploy(PaymentGateway, Storage.address, 'PaymentGateway'))
  .then(() => deployer.deploy(PaymentProcessor))
=======
  .then(() => deployer.deploy(UserFactory, Mock.address))
  .then(() => deployer.deploy(RatingsAndReputationLibrary, Storage.address, 'RatingsAndReputationLibrary', Mock.address))
  .then(() => deployer.deploy(IPFSLibrary, Storage.address, 'IPFSLibrary', Mock.address))
  .then(() => deployer.deploy(SkillsLibrary, Storage.address, 'SkillsLibrary', Mock.address))
  .then(() => deployer.deploy(Roles2Library, Storage.address, 'Roles2Library'))
  .then(() => deployer.deploy(UserLibrary, Storage.address, 'UserLibrary', Mock.address))
  .then(() => deployer.deploy(ERC20Library, Storage.address, 'ERC20Library', Mock.address))
  .then(() => deployer.deploy(PaymentGateway, Storage.address, 'PaymentGateway', Mock.address, ERC20Library.address))
  .then(() => deployer.deploy(PaymentProcessor, Mock.address))
  .then(() => deployer.deploy(JobController, Storage.address, 'JobController', Mock.address, ERC20Library.address))
>>>>>>> roles2
  .then(() => true);
};
