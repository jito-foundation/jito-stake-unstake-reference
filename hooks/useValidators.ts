import { useConnection } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getStakePoolAccount } from '@solana/spl-stake-pool';
import { JITO_STAKE_POOL_ADDRESS } from '../constants';
import * as BufferLayout from '@solana/buffer-layout';
import * as Layout from '@solana/buffer-layout-utils';

// Validator info structure from the validator list
interface ValidatorInfo {
    voteAccountAddress: PublicKey;
    status: number;
    activeStakeLamports: bigint;
}

// Layout for the validator list account
const ValidatorListLayout = BufferLayout.struct([
    BufferLayout.u32('accountType'),
    BufferLayout.u32('maxValidators'),
    BufferLayout.u32('validatorCount'),
    BufferLayout.seq(
        BufferLayout.struct([
            Layout.publicKey('voteAccountAddress'),
            BufferLayout.nu64('activeStakeLamports'),
            BufferLayout.nu64('transientStakeLamports'),
            BufferLayout.nu64('lastUpdateEpoch'),
            BufferLayout.nu64('transientSeedSuffixStart'),
            BufferLayout.nu64('transientSeedSuffixEnd'),
            BufferLayout.u8('status'),
            BufferLayout.seq(BufferLayout.u8(), 7, 'padding'),
        ]),
        BufferLayout.u32(),
        'validators'
    ),
]);

export interface Validator {
    voteAccount: PublicKey;
    activeStakeLamports: bigint;
    isActive: boolean;
}

/**
 * Hook to fetch the list of validators in the Jito stake pool
 */
export const useValidators = () => {
    const { connection } = useConnection();
    const [validators, setValidators] = useState<Validator[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchValidators = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Get stake pool account
                const stakePoolAccount = await getStakePoolAccount(
                    connection as any,
                    JITO_STAKE_POOL_ADDRESS
                );

                if (!stakePoolAccount) {
                    throw new Error('Failed to get stake pool account');
                }

                // Fetch validator list account
                const validatorListAccountInfo = await connection.getAccountInfo(
                    stakePoolAccount.account.data.validatorList
                );

                if (!validatorListAccountInfo) {
                    throw new Error('Failed to fetch validator list');
                }

                // Decode validator list
                const validatorListData = ValidatorListLayout.decode(validatorListAccountInfo.data);

                // Map validators to a simpler format
                const validatorList: Validator[] = validatorListData.validators
                    .filter((v: ValidatorInfo) => v.status === 0) // Only active validators
                    .map((v: ValidatorInfo) => ({
                        voteAccount: v.voteAccountAddress,
                        activeStakeLamports: v.activeStakeLamports,
                        isActive: v.status === 0,
                    }))
                    .sort((a: Validator, b: Validator) =>
                        // Sort by active stake descending
                        Number(b.activeStakeLamports - a.activeStakeLamports)
                    );

                setValidators(validatorList);
            } catch (err) {
                console.error('Error fetching validators:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch validators');
            } finally {
                setIsLoading(false);
            }
        };

        fetchValidators();
    }, [connection?.rpcEndpoint]);

    return { validators, isLoading, error };
};
