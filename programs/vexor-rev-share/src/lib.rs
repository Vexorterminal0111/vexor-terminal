use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("xkxpE8AHBFsihLRHms6ZZKMrPqLneF198Cnp3mfWTqf");

/// VexorRevShare — flat single-sided $VEXOR staking with manual pro-rata
/// reward push.
///
/// Port of the Solidity VexorRevShare contract. Stakers deposit $VEXOR and
/// become entitled to a pro-rata share of any rewards the owner pushes via
/// `push_rewards`. Rewards are distributed instantly using a MasterChef-style
/// accumulator (`acc_reward_per_token`). No lock period, no tier multipliers,
/// withdraw any time. Reward token == staking token.
///
/// Accounting (per user):
///   pending = balance * acc_reward_per_token / ACC_PRECISION - reward_debt
#[program]
pub mod vexor_rev_share {
    use super::*;

    pub const ACC_PRECISION: u128 = 1_000_000_000_000_000_000; // 1e18

    /// Initialise the pool. Called once by the deployer.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.staking_mint = ctx.accounts.staking_mint.key();
        pool.vault = ctx.accounts.vault.key();
        pool.total_staked = 0;
        pool.acc_reward_per_token = 0;
        pool.bump = ctx.bumps.pool;
        pool.vault_bump = ctx.bumps.vault;

        msg!("vexor_rev_share: pool initialized");
        Ok(())
    }

    /// Stake `amount` tokens. Pending rewards are auto-claimed first.
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, RevShareError::ZeroAmount);

        let staker = &mut ctx.accounts.staker;
        let pool = &mut ctx.accounts.pool;

        // Settle pending rewards before updating balance.
        let pending = calc_pending(staker.balance, pool.acc_reward_per_token, staker.reward_debt);
        if pending > 0 {
            transfer_from_vault(
                &ctx.accounts.vault,
                &ctx.accounts.user_token_account,
                &ctx.accounts.token_program,
                pool,
                pending,
            )?;
            emit!(Claimed {
                user: ctx.accounts.user.key(),
                reward: pending,
            });
        }

        // Transfer tokens from user → vault.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        staker.balance = staker.balance.checked_add(amount as u128).unwrap();
        pool.total_staked = pool.total_staked.checked_add(amount as u128).unwrap();
        staker.reward_debt = staker
            .balance
            .checked_mul(pool.acc_reward_per_token)
            .unwrap()
            / ACC_PRECISION;

        emit!(Staked {
            user: ctx.accounts.user.key(),
            amount,
            new_balance: staker.balance,
        });

        Ok(())
    }

    /// Withdraw `amount` of staked principal. Pending rewards auto-claimed.
    pub fn withdraw(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, RevShareError::ZeroAmount);

        let staker = &mut ctx.accounts.staker;
        let pool = &mut ctx.accounts.pool;

        require!(
            staker.balance >= amount as u128,
            RevShareError::InsufficientBalance
        );

        // Settle pending rewards.
        let pending = calc_pending(staker.balance, pool.acc_reward_per_token, staker.reward_debt);
        if pending > 0 {
            transfer_from_vault(
                &ctx.accounts.vault,
                &ctx.accounts.user_token_account,
                &ctx.accounts.token_program,
                pool,
                pending,
            )?;
            emit!(Claimed {
                user: ctx.accounts.user.key(),
                reward: pending,
            });
        }

        // Transfer principal back to user.
        transfer_from_vault(
            &ctx.accounts.vault,
            &ctx.accounts.user_token_account,
            &ctx.accounts.token_program,
            pool,
            amount,
        )?;

        staker.balance = staker.balance.checked_sub(amount as u128).unwrap();
        pool.total_staked = pool.total_staked.checked_sub(amount as u128).unwrap();
        staker.reward_debt = staker
            .balance
            .checked_mul(pool.acc_reward_per_token)
            .unwrap()
            / ACC_PRECISION;

        emit!(Withdrawn {
            user: ctx.accounts.user.key(),
            amount,
            new_balance: staker.balance,
        });

        Ok(())
    }

    /// Claim pending rewards without touching the principal.
    pub fn claim(ctx: Context<Stake>) -> Result<()> {
        let staker = &mut ctx.accounts.staker;
        let pool = &ctx.accounts.pool;

        let pending = calc_pending(staker.balance, pool.acc_reward_per_token, staker.reward_debt);
        if pending > 0 {
            transfer_from_vault(
                &ctx.accounts.vault,
                &ctx.accounts.user_token_account,
                &ctx.accounts.token_program,
                pool,
                pending,
            )?;
            emit!(Claimed {
                user: ctx.accounts.user.key(),
                reward: pending,
            });
        }

        staker.reward_debt = staker
            .balance
            .checked_mul(pool.acc_reward_per_token)
            .unwrap()
            / ACC_PRECISION;

        Ok(())
    }

    /// Owner pushes `amount` reward tokens, distributing pro-rata to stakers.
    pub fn push_rewards(ctx: Context<PushRewards>, amount: u64) -> Result<()> {
        require!(amount > 0, RevShareError::ZeroAmount);

        let pool = &mut ctx.accounts.pool;
        require!(pool.total_staked > 0, RevShareError::NoStakers);

        pool.acc_reward_per_token = pool
            .acc_reward_per_token
            .checked_add(
                (amount as u128)
                    .checked_mul(ACC_PRECISION)
                    .unwrap()
                    .checked_div(pool.total_staked)
                    .unwrap(),
            )
            .unwrap();

        // Transfer reward tokens from owner → vault.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(RewardsPushed {
            from: ctx.accounts.authority.key(),
            amount,
            new_acc: pool.acc_reward_per_token,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn calc_pending(balance: u128, acc: u128, debt: u128) -> u64 {
    if balance == 0 {
        return 0;
    }
    let owed = balance
        .checked_mul(acc)
        .unwrap()
        .checked_div(vexor_rev_share::ACC_PRECISION)
        .unwrap()
        .checked_sub(debt)
        .unwrap();
    owed as u64
}

fn transfer_from_vault<'info>(
    vault: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    pool: &Pool,
    amount: u64,
) -> Result<()> {
    let seeds: &[&[u8]] = &[b"vault", pool.staking_mint.as_ref(), &[pool.vault_bump]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: vault.to_account_info(),
                to: to.to_account_info(),
                authority: vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", staking_mint.key().as_ref()],
        bump,
    )]
    pub pool: Account<'info, Pool>,

    /// Token vault PDA that holds staked tokens + rewards.
    #[account(
        init,
        payer = authority,
        token::mint = staking_mint,
        token::authority = vault,
        seeds = [b"vault", staking_mint.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub staking_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Staker::INIT_SPACE,
        seeds = [b"staker", pool.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub staker: Account<'info, Staker>,

    #[account(
        mut,
        seeds = [b"vault", pool.staking_mint.as_ref()],
        bump = pool.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PushRewards<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
        has_one = authority,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"vault", pool.staking_mint.as_ref()],
        bump = pool.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub authority: Pubkey,
    pub staking_mint: Pubkey,
    pub vault: Pubkey,
    pub total_staked: u128,
    pub acc_reward_per_token: u128,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Staker {
    pub balance: u128,
    pub reward_debt: u128,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct Staked {
    pub user: Pubkey,
    pub amount: u64,
    pub new_balance: u128,
}

#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub amount: u64,
    pub new_balance: u128,
}

#[event]
pub struct Claimed {
    pub user: Pubkey,
    pub reward: u64,
}

#[event]
pub struct RewardsPushed {
    pub from: Pubkey,
    pub amount: u64,
    pub new_acc: u128,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum RevShareError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient staked balance")]
    InsufficientBalance,
    #[msg("No stakers in the pool")]
    NoStakers,
}
