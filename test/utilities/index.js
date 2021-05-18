const { utils } = require('ethers/lib');
const { BigNumber } = require('ethers');

FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2,
};

function getSelectors(contract) {
  const signatures = [];
  for (const key of Object.keys(contract.functions)) {
    signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
  }
  return signatures;
}

module.exports = {
  FacetCutAction: this.FacetCutAction,
  getSelectors: this.getSelectors,
  prepare: async (thisObject, contracts) => {
    for (let i in contracts) {
      let contract = contracts[i];
      thisObject[contract] = await ethers.getContractFactory(contract);
    }
    thisObject.signers = await ethers.getSigners();

    thisObject.alice = thisObject.signers[0];
    thisObject.bob = thisObject.signers[1];
    thisObject.carol = thisObject.signers[2];
    thisObject.gov = thisObject.signers[3];

    thisObject.alice.address = await thisObject.signers[0].getAddress();
    thisObject.bob.address = await thisObject.signers[1].getAddress();
    thisObject.carol.address = await thisObject.signers[2].getAddress();
    thisObject.gov.address = await thisObject.signers[3].getAddress();

    thisObject.alice.key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    thisObject.bob.key = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    thisObject.carol.key = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
    thisObject.gov.key = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';

    thisObject.protocolX = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7';
    thisObject.protocolY = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c8';
    thisObject.protocolZ = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c9';

    thisObject.nonProtocol1 = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c1';
    thisObject.nonProtocol2 = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c2';
  },
  deploy: async (thisObject, contracts) => {
    for (let i in contracts) {
      let contract = contracts[i];
      thisObject[contract[0]] = await contract[1].deploy(...(contract[2] || []));
      try {
        const decimals = await thisObject[contract[0]].decimals();
        thisObject[contract[0]].dec = decimals;
        thisObject[contract[0]].usdDec = 18 + (18 - decimals);
      } catch (err) {}
      await thisObject[contract[0]].deployed();
    }
  },
  solution: async (thisObject, thisName, gov) => {
    libPool = await (await ethers.getContractFactory('LibPool')).deploy();
    libSherX = await (
      await ethers.getContractFactory('LibSherX', {
        libraries: {
          LibPool: libPool.address,
        },
      })
    ).deploy();

    facets = [
      await ethers.getContractFactory('Gov'),
      await ethers.getContractFactory('GovDev'),
      await ethers.getContractFactory('Manager', {
        libraries: {
          LibPool: libPool.address,
          LibSherX: libSherX.address,
        },
      }),
      await ethers.getContractFactory('Payout', {
        libraries: {
          LibPool: libPool.address,
          LibSherX: libSherX.address,
        },
      }),
      await ethers.getContractFactory('Pool', {
        libraries: { LibPool: libPool.address },
      }),
      await ethers.getContractFactory('SherX', {
        libraries: {
          LibPool: libPool.address,
          LibSherX: libSherX.address,
        },
      }),
      await ethers.getContractFactory('SherXERC20'),
    ];

    diamondCut = [];
    for (let i = 0; i < facets.length; i++) {
      const f = await facets[i].deploy();
      diamondCut.push({
        action: FacetCutAction.Add,
        facetAddress: f.address,
        functionSelectors: getSelectors(f),
      });
    }

    Diamond = await ethers.getContractFactory('Diamond');

    const diamond = await Diamond.deploy(diamondCut, [gov.address]);
    const sherlock = await ethers.getContractAt('ISherlock', diamond.address);
    sherlock.c = sherlock.connect;
    await sherlock.c(gov).setInitialGovInsurance(gov.address);
    await sherlock.c(gov).setInitialGovPayout(gov.address);
    await sherlock.c(gov).initializeSherXERC20('Sherlock ETF', 'SHERX');

    thisObject[thisName] = sherlock;
  },
  blockNumber: async (tx) => {
    return BigNumber.from(await (await tx).blockNumber);
  },
  events: async (tx) => {
    return (await (await tx).wait()).events;
  },
};
