import BigNumber from "bignumber.js";
import axios from "axios";
import { TezosToolkit } from "@taquito/taquito";
import { writeFileSync } from "fs";

// This script fetches the results of the first youves governance vote.

const tezos = new TezosToolkit(
  "https://tezos-node-youves.prod.gke.papers.tech"
);

const YIP = "013";
const votingContract = "KT1VgUR7yCtiUZYPrGfuLsibTUrqF4gPprHN";
const voteHash = "ipfs://QmZ9BCCC2KTYCU7CKUu2Bga9UkzPRnwLrqrkYGkDnfvvVX";
const endBlockLevel = 3_127_958;

const unifiedStakingContractAddress = "KT1UZcNDxTdkn33Xx5HRkqQoZedc3mEs11yV";
const youTokenAddress = "KT1Xobej4mc6XgEjDoJoHtTKgbD1ELMvcQuL";
const youTokenId = 0;

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

export interface YouHolding {
  address: string;
  vote: "1" | "0";
  totalYOU: string;
  youInUnifiedStakingPool: string;
}

export interface UnifiedStakeItem {
  id: BigNumber;
  age_timestamp: string;
  stake: BigNumber;
  token_amount: BigNumber;
}

const calculateUnifiedStakingAmount = async (
  unifiedStakingContractStorage: any,
  unifiedStakingContractYouBalance: BigNumber,
  address: string
): Promise<BigNumber> => {
  const stakeIds: BigNumber[] =
    (await unifiedStakingContractStorage["stakes_owner_lookup"].get(
      address,
      endBlockLevel
    )) ?? [];

  const stakes: UnifiedStakeItem[] = await Promise.all(
    stakeIds.map(async (id) => ({
      id,
      ...(await unifiedStakingContractStorage["stakes"].get(id, endBlockLevel)),
    }))
  );

  const extendedStakes = stakes.map((stake) => {
    const entireWithdrawableAmount = unifiedStakingContractYouBalance
      .times(stake.stake)
      .div(unifiedStakingContractStorage.total_stake);

    return {
      ...stake,
      entireWithdrawableAmount,
    };
  });

  const result = extendedStakes.reduce(
    (pv, cv) => pv.plus(cv.entireWithdrawableAmount),
    new BigNumber(0)
  );

  return result;
};

const run = async () => {
  const you = await tezos.contract.at(youTokenAddress); // YOU token contract
  const youStorage: any = await you.storage();

  const unifiedStakingContract = await tezos.contract.at(
    unifiedStakingContractAddress
  ); // YOU Unified Staking

  const unifiedStakingContractStorage = await unifiedStakingContract.storage();

  const unifiedStakingContractYouBalance = await youStorage.ledger.get(
    { owner: unifiedStakingContractAddress, token_id: youTokenId },
    endBlockLevel
  );

  const getYOUHoldings = async (
    address: string,
    vote: "1" | "0"
  ): Promise<YouHolding> => {
    console.log("Checking: ", address);

    const youInUnifiedStakingPool = await calculateUnifiedStakingAmount(
      unifiedStakingContractStorage,
      unifiedStakingContractYouBalance,
      address
    );

    // Sleep because of rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      address,
      vote,
      totalYOU: youInUnifiedStakingPool
        .decimalPlaces(0, BigNumber.ROUND_DOWN)
        .toString(10),
      youInUnifiedStakingPool: youInUnifiedStakingPool
        .decimalPlaces(0, BigNumber.ROUND_DOWN)
        .toString(10),
    };
  };

  const holdings: YouHolding[] = [];

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
      `Address,Vote,TotalYOU,youInUnifiedStakingPool\n` +
        holdings
          .map((row) => {
            console.log(
              `1 - We have YES: ${totalYOUYes}, NO: ${totalYOUNo} | Adding ${row.totalYOU}`
            );

            if (row.vote === "1") {
              totalVotesYes++;
              totalYOUYes = totalYOUYes.plus(row.totalYOU);
            }
            if (row.vote === "0") {
              totalVotesNo++;
              totalYOUNo = totalYOUNo.plus(row.totalYOU);
            }

            console.log(`2 - We have YES: ${totalYOUYes}, NO: ${totalYOUNo}`);

            return [
              row.address,
              row.vote,
              row.totalYOU,
              row.youInUnifiedStakingPool,
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
