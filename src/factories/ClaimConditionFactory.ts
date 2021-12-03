import { BigNumber, BigNumberish, ethers } from "ethers";
import { PublicMintCondition } from "../types/claim-conditions/PublicMintCondition";
import ClaimConditionPhase from "./ClaimConditionPhase";

class ClaimConditionFactory {
  private phases: ClaimConditionPhase[] = [];

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  /**
   * Used internally when creating a drop module/updating
   * the claim conditions of a drop module.
   *
   * @internal
   *
   * @returns - The claim conditions that will be used when validating a users claim transaction.
   */
  public buildConditions(): PublicMintCondition[] {
    const publicClaimConditions = this.phases.map((c) =>
      c.buildPublicClaimCondition(),
    );

    // TODO: write test to ensure they're sorted by start time, earliest first
    const sorted = publicClaimConditions.sort((a, b) => {
      if (a.startTimestamp.eq(b.startTimestamp)) {
        return 0;
      } else if (a.startTimestamp.gt(b.startTimestamp)) {
        return 1;
      } else {
        return -1;
      }
    });

    return sorted;
  }

  /**
   * Converts a set of generic `PublicMintCondition`s into a `ClaimConditionFactory`
   *
   * @param conditions - The conditions to load, should be returned directly from the contract.
   * @returns - The loaded claim condition factory.
   */
  public fromPublicClaimConditions(conditions: PublicMintCondition[]) {
    const phases = [];
    for (const condition of conditions) {
      const phase = new ClaimConditionPhase();

      // If there's a price, there must also be an associated currency
      if (condition.currency) {
        phase.setPrice(condition.pricePerToken, condition.currency);
      }

      if (condition.maxMintSupply) {
        phase.setMaxQuantity(condition.maxMintSupply);
      }

      phase.setConditionStartTime(
        new Date(condition.startTimestamp.toNumber() * 1000),
      );
      phases.push(phase);
    }
    this.phases = phases;
    return this;
  }

  /**
   * Creates a new claim 'phase' with its own set of claim conditions
   *
   * @param startTime - The start time of the phase in epoch seconds or a `Date` object.
   * @param maxQuantity - The max quantity of the phase. By default, this is set to be infinite. In most cases, if your drop only
   has a single phase, you don't need to override this value. If your drop has multiple phases, you should override this value and specify how many tokens are available for each specific phase.
    * @param maxQuantityPerTransaction - The maximum number of claims that can be made in a single transaction. By default, this is set to infinite which means that there is no limit.
   *
   * @returns - The claim condition builder.
   */
  public newClaimPhase({
    startTime,
    maxQuantity = ethers.constants.MaxUint256,
    maxQuantityPerTransaction = ethers.constants.MaxUint256,
  }: {
    startTime: Date | number;
    maxQuantity?: BigNumberish;
    maxQuantityPerTransaction?: BigNumberish;
  }): ClaimConditionPhase {
    const condition = new ClaimConditionPhase();

    condition.setConditionStartTime(startTime);
    condition.setMaxQuantity(BigNumber.from(maxQuantity));
    condition.setMaxQuantityPerTransaction(
      BigNumber.from(maxQuantityPerTransaction),
    );

    this.phases.push(condition);
    return condition;
  }

  /**
   * Removes a claim condition phase from the factory.
   *
   * @param phase - The phase to remove
   */
  public removeClaimPhase(index: number): void {
    if (index < 0 || index >= this.phases.length) {
      return;
    }

    const sorted = this.buildConditions();
    const cleared = sorted.splice(index - 1, 1);
    this.fromPublicClaimConditions(cleared);
  }
}

export default ClaimConditionFactory;
