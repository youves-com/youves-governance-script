import BigNumber from "bignumber.js";
import axios from "axios";
import { TezosToolkit } from "@taquito/taquito";
import { writeFileSync } from "fs";

// This script fetches the results of the first youves governance vote.

const tezos = new TezosToolkit(
  "https://tezos-node-youves.prod.gke.papers.tech"
);

const YIP = "005";
const votingContract = "KT1VgUR7yCtiUZYPrGfuLsibTUrqF4gPprHN";
const voteHash = "ipfs://QmP8xEFKnGYsYQJvu3kwXizmFhr7nCDHKLuQGu7axSHMft";
const endBlockLevel = 2_214_853;

const doRequest = async (
  offset: number
): Promise<{ operations: any[]; last_id: number }> => {
  console.log("getting 10 operations...");
  const res = await axios.get(
    `https://api.better-call.dev/v1/contract/mainnet/${votingContract}/operations?last_id=${offset}`
  );
  return res.data as any;
};

const getVotes = async (): Promise<{ address: string; vote: "1" | "0" }[]> => {
  const output: { address: string; vote: "1" | "0" }[] = [];
  let last_id = Number.MAX_SAFE_INTEGER;
  let i = 1;
  while (i > 0) {
    const data = await doRequest(last_id);
    last_id = data.last_id;
    i = data.operations.length;

    const filteredOperations = data.operations
      // Filter out any invalid transactions
      .filter(
        (op) =>
          op.level < endBlockLevel &&
          op.entrypoint === "vote" &&
          op.status === "applied" &&
          op.parameters[0].name === "vote" &&
          op.parameters[0].children[0].value === voteHash
      )
      .map((op) => ({
        address: op.source,
        vote: op.parameters[0].children[1].value,
      }));

    console.log("FILTERED", filteredOperations);
    for (let op of filteredOperations) {
      // Count only the newest vote (ignore older ones)
      if (!output.some((o) => o.address === op.address)) {
        output.push(op);
      } else {
        // console.log('ignored older, duplicate vote', op)
      }
    }
  }
  return output;
};

const run = async () => {
  const you = await tezos.contract.at("KT1Xobej4mc6XgEjDoJoHtTKgbD1ELMvcQuL"); // YOU token contract
  const youStorage: any = await you.storage();
  const stakePool = await tezos.contract.at(
    "KT1Lz5S39TMHEA7izhQn8Z1mQoddm6v1jTwH"
  ); // YOU staking pool (uUSD)
  const stakePoolStorage: any = await stakePool.storage();
  const stakePooluDEFI = await tezos.contract.at(
    "KT1TFPn4ZTzmXDzikScBrWnHkoqTA7MBt9Gi"
  ); // YOU staking pool (uDEFI)
  const stakePoolStorageuDEFI: any = await stakePooluDEFI.storage();
  const stakePooluBTC = await tezos.contract.at(
    "KT19bkpis4NSDnt6efuh65vYxMaMHBoKoLEw"
  ); // YOU staking pool (uBTC)
  const stakePoolStorageuBTC: any = await stakePooluBTC.storage();

  const quipuPool = await tezos.contract.at(
    "KT1PL1YciLdwMbydt21Ax85iZXXyGSrKT2BE"
  ); // Quipuswap liquidity pool
  const quipuPoolStorage: any = await quipuPool.storage();

  const plentyYOU = await tezos.contract.at(
    "KT1EM6NjJdJXmz3Pj13pfu3MWVDwXEQnoH3N"
  ); // Plenty / YOU swap
  const plentyYOUStorage: any = await plentyYOU.storage();
  const plentyLPToken = await tezos.contract.at(
    "KT1UaU5fbSYqYeFmhmsjLkqQXZ1ZG54Qs2vh"
  ); // PLENTY / YOU LP Token
  const plentyLPTokenStorage: any = await plentyLPToken.storage();
  const plentyFarm = await tezos.contract.at(
    "KT1MkXtVBuCKtxqSh7APrg2d7ThGBmEf4hnw"
  ); // PLENTY / YOU LP farm
  const plentyFarmStorage: any = await plentyFarm.storage();

  const uusdYOU = await tezos.contract.at(
    "KT1TnrLFrdemNZ1AnnWNfi21rXg7eknS484C"
  ); // uusd / YOU swap
  const uusdYOUStorage: any = await uusdYOU.storage();
  const uusdLPToken = await tezos.contract.at(
    "KT1Tmncfgpp4ZSp6aEogL7uhBqHTiKsSPegK"
  ); // uusd / YOU LP Token
  const uusdLPTokenStorage: any = await uusdLPToken.storage();
  const uusdFarm = await tezos.contract.at(
    "KT1KGKzNGX1NDP3hGcipzyqVMCkwWbH76NJU"
  ); // uusd / YOU LP farm
  const uusdFarmStorage: any = await uusdFarm.storage();
  const uusdYouvesFarm = await tezos.contract.at(
    "KT1Goz5Dsi8Hf7fqjx5nSEcjp6osD9ufECB2"
  ); // uusd / YOU LP farm on YOUVES
  const uusdYouvesFarmStorage: any = await uusdYouvesFarm.storage();

  const getYOUHoldings = async (
    address: string,
    vote: "1" | "0"
  ): Promise<{
    address: string;
    vote: "1" | "0";
    totalYOU: string;
    youInWallet: string;
    youInStakingPool: string;
    youInStakinguDEFIPool: string;
    youInStakinguBTCPool: string;
    youInQuipuswapPool: string;
    youInPlentyPool: string;
    youInUusdPool: string;
  }> => {
    console.log("Checking: ", address);

    const youInWallet =
      (await youStorage.ledger.get(
        { owner: address, token_id: 0 },
        endBlockLevel
      )) ?? new BigNumber(0);

    const youInStakingPool =
      (await stakePoolStorage.stakes.get(address, endBlockLevel)) ??
      new BigNumber(0);
    const youInStakinguDEFIPool =
      (await stakePoolStorageuDEFI.stakes.get(address, endBlockLevel)) ??
      new BigNumber(0);
    const youInStakinguBTCPool =
      (await stakePoolStorageuBTC.stakes.get(address, endBlockLevel)) ??
      new BigNumber(0);

    let youInQuipuswapPool = new BigNumber(0);
    let youInPlentyPool = new BigNumber(0);
    let youInUusdPool = new BigNumber(0);

    {
      const quipuLPTokenPersonal = await quipuPoolStorage.storage.ledger.get(
        address,
        endBlockLevel
      );
      if (quipuLPTokenPersonal) {
        const ownLPBalance = quipuLPTokenPersonal.balance;

        // There is no farm for the XTZ/YOU pool

        const quipuFarmShare = new BigNumber(ownLPBalance).div(
          quipuPoolStorage.storage.total_supply
        );
        youInQuipuswapPool = quipuFarmShare.times(
          quipuPoolStorage.storage.token_pool
        );
      }
    }

    {
      const plentyLPTokenPersonal = await plentyLPTokenStorage.balances.get(
        address,
        endBlockLevel
      );
      if (plentyLPTokenPersonal) {
        const ownLPBalance = plentyLPTokenPersonal.balance;

        // Check plenty farm
        const farmLPBalance = new BigNumber(
          (await plentyFarmStorage.balances.get(address, endBlockLevel)).balance
        ).div(1000); // ???: 18 decimals here, but usually has only 15?

        const totalLPBalance = new BigNumber(ownLPBalance).plus(farmLPBalance);

        const farmShare = new BigNumber(totalLPBalance).div(
          plentyYOUStorage.totalSupply
        );
        youInPlentyPool = farmShare.times(plentyYOUStorage.token2_pool);
      }
    }

    {
      const uusdYOULPTokenPersonal = await uusdLPTokenStorage.balances.get(
        address,
        endBlockLevel
      );
      if (uusdYOULPTokenPersonal) {
        const ownLPBalance = uusdYOULPTokenPersonal.balance;

        // Check uusdYOU farm
        const farmLPBalance = new BigNumber(
          (await uusdFarmStorage.balances.get(address, endBlockLevel))
            ?.balance ?? 0
        ).div(1000); // ???: 18 decimals here, but usually has only 15?
        // Check uusdYOU farm
        const youvesFarmLPBalance = new BigNumber(
          (await uusdYouvesFarmStorage.stakes.get(address, endBlockLevel))
            ?.stake ?? 0
        );

        const totalLPBalance = new BigNumber(ownLPBalance)
          .plus(farmLPBalance)
          .plus(youvesFarmLPBalance);

        const farmShare = new BigNumber(totalLPBalance).div(
          uusdYOUStorage.totalSupply
        );
        youInUusdPool = farmShare.times(uusdYOUStorage.token2_pool);
      }
    }

    // Sleep because of rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      address,
      vote,
      totalYOU: youInWallet
        .plus(youInStakingPool)
        .plus(youInStakinguDEFIPool)
        .plus(youInStakinguBTCPool)
        .plus(youInQuipuswapPool)
        .plus(youInPlentyPool)
        .plus(youInUusdPool)
        .toString(10),
      youInWallet: youInWallet.toString(10),
      youInStakingPool: youInStakingPool.toString(10),
      youInStakinguDEFIPool: youInStakinguDEFIPool.toString(10),
      youInStakinguBTCPool: youInStakinguBTCPool.toString(10),
      youInQuipuswapPool: youInQuipuswapPool.toString(10),
      youInPlentyPool: youInPlentyPool.toString(10),
      youInUusdPool: youInUusdPool.toString(10),
    };
  };

  const holdings: any[] = [];

  getVotes().then(async (votes) => {
    console.log(
      `There are ${votes.length} individual votes. ${
        votes.filter((v) => v.vote === "1").length
      } yes and ${votes.filter((v) => v.vote === "0").length} no.`
    );

    for (let vote of votes) {
      holdings.push(await getYOUHoldings(vote.address, vote.vote));
    }

    let totalVotesYes = 0;
    let totalVotesNo = 0;
    let totalYOUYes = new BigNumber(0);
    let totalYOUNo = new BigNumber(0);

    writeFileSync(
      `./votes-${YIP}.csv`,
      `Address,Vote,TotalYOU,youInWallet,youInStakinguUSDPool,youInStakinguDEFIPool,youInStakinguBTCPool,youInQuipuswapPool,youInPlentyPool,youInUusdPool\n` +
        holdings
          .map((row) => {
            if (row.vote === "1") {
              totalVotesYes++;
              totalYOUYes = totalYOUYes.plus(row.totalYOU);
            }
            if (row.vote === "0") {
              totalVotesNo++;
              totalYOUNo = totalYOUNo.plus(row.totalYOU);
            }

            return [
              row.address,
              row.vote,
              row.totalYOU,
              row.youInWallet,
              row.youInStakingPool,
              row.youInStakinguDEFIPool,
              row.youInStakinguBTCPool,
              row.youInQuipuswapPool,
              row.youInPlentyPool,
              row.youInUusdPool,
            ].join(",");
          })
          .join("\n") +
        `\n` +
        `Total votes YES,${totalVotesYes}\n` +
        `Total votes NO,${totalVotesNo}\n` +
        `Total YOU YES,${totalYOUYes}\n` +
        `Total YOU NO,${totalYOUNo}\n` +
        `Total YOU VOTED,${totalYOUYes.plus(totalYOUNo)}\n`
    );
  });
};

run();
