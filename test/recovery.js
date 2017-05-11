const Recovery = artifacts.require('./Recovery.sol');
const UserMock = artifacts.require('./UserMock.sol');
const Reverter = require('./helpers/reverter');

contract('Recovery', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  let recovery;
  let userMock;
  let newUser = '0xffffffffffffffffffffffffffffffffffffffff';
  let prevUser = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

  before('setup', () => {
    return Recovery.deployed()
    .then(instance => recovery = instance)
    .then(() => UserMock.deployed())
    .then(instance => userMock = instance)
    .then(() => userMock.setContractOwner(prevUser))
    .then(reverter.snapshot);
  });

  it('should recover users', () => {
    return recovery.recoverUser(userMock.address, newUser)
    .then(result => {
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, 'UserRecovered');
      assert.equal(result.logs[0].args.prevUser, prevUser);
      assert.equal(result.logs[0].args.newUser, newUser);
      assert.equal(result.logs[0].args.userContract, userMock.address);
      assert.notEqual(result.logs[0].args.newUser, result.logs[0].args.prevUser);
    })
    .then(() => userMock.recoverUserCalls())
    .then(result => assert.equal(result.toString(), '1'));
  });

})
