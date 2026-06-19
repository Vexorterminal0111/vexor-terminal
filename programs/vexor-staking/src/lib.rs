use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("HLay9ySRAs3AZxsfXNWPnxcVAv8rj6v3kAyd3gBvNoyf");

/// VexorStaking — lock-period staking with tiered reward multipliers.
///
/// Port of the Solidity VexorStaking contract. Users stake $VEXOR for a fixed
/// lock period and earn a pro-rata share of per-second reward emissions,
/// multiplied by their tier weight:
///
///   - 30  days → 1.0x
///   - 90  days → 1.5x
///   - 180 days → 2.0x
///   - 365 days → 3.0x
///
/// Reward token == staking token ($VEXOR). The authority funds rewards by
/// calling `notify_rewards(amount, duration)`.
#[program]
pub mod vexor_staking {
    use super::*;

    pub const ACC_PRECISION: u128 = 1_000_000_000_000_000_000;
    pub const MULT_BPS: u64 = 10_000;
    pub const MULT_30: u64 = 10_000;
    pub const MULT_90: u64 = 15_000;
    pub const MULT_180: u64 = 20_000;
    pub const MULT_365: u64 = 30_000;

    /// Initialise the staking pool. Called once by the deployer.
    pub fn initialize(ctx: Context<InitializePool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.staking_mint = ctx.accounts.staking_mint.key();
        pool.vault = ctx.accounts.vault.key();
        pool.total_weighted = 0;
        pool.acc_reward_per_weighted = 0;
        pool.last_update = Clock::get()?.unix_timestamp;
        pool.reward_rate_per_second = 0;
        pool.reward_period_end = 0;
        pool.next_position_id = 0;
        pool.bump = ctx.bumps.pool;
        pool.vault_bump = ctx.bumps.vault;

        msg!("vexor_staking: pool initialized");
        Ok(())
    }

    /// Stake `amount` tokens for a given `tier` (0..3).
    pub fn stake(ctx: Context<StakeTokens>, amount: u64, tier: u8) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        require!(tier <= 3, StakingError::InvalidTier);

        let pool = &mut ctx.accounts.pool;
        update_accumulator(pool)?;

        let mult = multiplier_bps(tier);
        let weighted = (amount as u128)
            .checked_mul(mult as u128)
            .unwrap()
            .checked_div(MULT_BPS as u128)
            .unwrap();

        let now = Clock::get()?.unix_timestamp;
        let lock_secs = lock_seconds(tier);

        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.user.key();
        position.pool = pool.key();
        position.amount = amount;
        position.weighted = weighted;
        position.start = now;
        position.unlock = now.checked_add(lock_secs).unwrap();
        position.tier = tier;
        position.reward_debt = weighted
            .checked_mul(pool.acc_reward_per_weighted)
            .unwrap()
            .checked_div(ACC_PRECISION)
            .unwrap();
        position.position_id = pool.next_position_id;

        pool.next_position_id = pool.next_position_id.checked_add(1).unwrap();
        pool.total_weighted = pool.total_weighted.checked_add(weighted).unwrap();

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

        emit!(StakeEvent {
            user: ctx.accounts.user.key(),
            position_id: position.position_id,
            amount,
            tier,
            unlock: position.unlock,
        });

        Ok(())
    }

    /// Claim pending rewards for a position without touching principal.
    pub fn claim_rewards(ctx: Context<ClaimOrWithdraw>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        update_accumulator(pool)?;

        let position = &mut ctx.accounts.position;
        require!(
            position.owner == ctx.accounts.user.key(),
            StakingError::NotOwner
        );

        let pending = calc_pending(position.weighted, pool.acc_reward_per_weighted, position.reward_debt);
        if pending > 0 {
            transfer_from_vault(
                &ctx.accounts.vault,
                &ctx.accounts.user_token_account,
                &ctx.accounts.token_program,
                pool,
                pending,
            )?;
            emit!(ClaimEvent {
                user: ctx.accounts.user.key(),
                position_id: position.position_id,
                reward: pending,
            });
        }

        position.reward_debt = position
            .weighted
            .checked_mul(pool.acc_reward_per_weighted)
            .unwrap()
            .checked_div(ACC_PRECISION)
            .unwrap();

        Ok(())
    }

    /// Withdraw principal + pending rewards after lock expires.
    pub fn withdraw(ctx: Context<ClaimOrWithdraw>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        update_accumulator(pool)?;

        let position = &mut ctx.accounts.position;
        require!(
            position.owner == ctx.accounts.user.key(),
            StakingError::NotOwner
        );
        require!(position.amount > 0, StakingError::EmptyPosition);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= position.unlock, StakingError::StillLocked);

        let pending = calc_pending(position.weighted, pool.acc_reward_per_weighted, position.reward_debt);
        let principal = position.amount;

        pool.total_weighted = pool
            .total_weighted
            .checked_sub(position.weighted)
            .unwrap();

        position.amount = 0;
        position.weighted = 0;
        position.reward_debt = 0;

        if pending > 0 {
            transfer_from_vault(
                &ctx.accounts.vault,
                &ctx.accounts.user_token_account,
                &ctx.accounts.token_program,
                pool,
                pending,
            )?;
            emit!(ClaimEvent {
                user: ctx.accounts.user.key(),
                position_id: position.position_id,
                reward: pending,
            });
        }

        transfer_from_vault(
            &ctx.accounts.vault,
            &ctx.accounts.user_token_account,
            &ctx.accounts.token_program,
            pool,
            principal,
        )?;

        emit!(WithdrawEvent {
            user: ctx.accounts.user.key(),
            position_id: position.position_id,
            amount: principal,
        });

        Ok(())
    }

    /// Authority notifies additional rewards that stream over `duration` seconds.
    pub fn notify_rewards(ctx: Context<NotifyRewards>, amount: u64, duration: i64) -> Result<()> {
        require!(duration > 0, StakingError::ZeroDuration);

        let pool = &mut ctx.accounts.pool;
        update_accumulator(pool)?;

        let now = Clock::get()?.unix_timestamp;
        let mut leftover: u128 = 0;
        if now < pool.reward_period_end {
            leftover = ((pool.reward_period_end - now) as u128)
                .checked_mul(pool.reward_rate_per_second)
                .unwrap();
        }

        pool.reward_rate_per_second = (amount as u128)
            .checked_add(leftover)
            .unwrap()
            .checked_div(duration as u128)
            .unwrap();
        pool.reward_period_end = now.checked_add(duration).unwrap();
        pool.last_update = now;

        // Transfer reward tokens from authority → vault.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.authority_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(RewardsNotified {
            amount,
            duration,
            ends_at: pool.reward_period_end,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn update_accumulator(pool: &mut Account<StakingPool>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    if now <= pool.last_update {
        return Ok(());
    }
    if pool.total_weighted == 0 {
        pool.last_update = now;
        return Ok(());
    }
    let end_time = if now < pool.reward_period_end {
        now
    } else {
        pool.reward_period_end
    };
    if end_time > pool.last_update {
        let elapsed = (end_time - pool.last_update) as u128;
        let reward = elapsed.checked_mul(pool.reward_rate_per_second).unwrap();
        pool.acc_reward_per_weighted = pool
            .acc_reward_per_weighted
            .checked_add(
                reward
                    .checked_mul(vexor_staking::ACC_PRECISION)
                    .unwrap()
                    .checked_div(pool.total_weighted)
                    .unwrap(),
            )
            .unwrap();
    }
    pool.last_update = now;
    Ok(())
}

fn calc_pending(weighted: u128, acc: u128, debt: u128) -> u64 {
    if weighted == 0 {
        return 0;
    }
    let owed = weighted
        .checked_mul(acc)
        .unwrap()
        .checked_div(vexor_staking::ACC_PRECISION)
        .unwrap()
        .checked_sub(debt)
        .unwrap();
    owed as u64
}

fn multiplier_bps(tier: u8) -> u64 {
    match tier {
        0 => vexor_staking::MULT_30,
        1 => vexor_staking::MULT_90,
        2 => vexor_staking::MULT_180,
        _ => vexor_staking::MULT_365,
    }
}

fn lock_seconds(tier: u8) -> i64 {
    match tier {
        0 => 30 * 86_400,
        1 => 90 * 86_400,
        2 => 180 * 86_400,
        _ => 365 * 86_400,
    }
}

fn transfer_from_vault<'info>(
    vault: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    pool: &StakingPool,
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
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + StakingPool::INIT_SPACE,
        seeds = [b"staking-pool", staking_mint.key().as_ref()],
        bump,
    )]
    pub pool: Account<'info, StakingPool>,

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
pub struct StakeTokens<'info> {
    #[account(
        mut,
        seeds = [b"staking-pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, StakingPool>,

    #[account(
        init,
        payer = user,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", pool.key().as_ref(), &pool.next_position_id.to_le_bytes()],
        bump,
    )]
    pub position: Account<'info, Position>,

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
pub struct ClaimOrWithdraw<'info> {
    #[account(
        mut,
        seeds = [b"staking-pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [b"position", pool.key().as_ref(), &position.position_id.to_le_bytes()],
        bump,
    )]
    pub position: Account<'info, Position>,

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
}

#[derive(Accounts)]
pub struct NotifyRewards<'info> {
    #[account(
        mut,
        seeds = [b"staking-pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
        has_one = authority,
    )]
    pub pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [b"vault", pool.staking_mint.as_ref()],
        bump = pool.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct StakingPool {
    pub authority: Pubkey,
    pub staking_mint: Pubkey,
    pub vault: Pubkey,
    pub total_weighted: u128,
    pub acc_reward_per_weighted: u128,
    pub last_update: i64,
    pub reward_rate_per_second: u128,
    pub reward_period_end: i64,
    pub next_position_id: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub position_id: u64,
    pub amount: u64,
    pub weighted: u128,
    pub start: i64,
    pub unlock: i64,
    pub tier: u8,
    pub reward_debt: u128,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct StakeEvent {
    pub user: Pubkey,
    pub position_id: u64,
    pub amount: u64,
    pub tier: u8,
    pub unlock: i64,
}

#[event]
pub struct ClaimEvent {
    pub user: Pubkey,
    pub position_id: u64,
    pub reward: u64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub position_id: u64,
    pub amount: u64,
}

#[event]
pub struct RewardsNotified {
    pub amount: u64,
    pub duration: i64,
    pub ends_at: i64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum StakingError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Invalid lock tier (must be 0..3)")]
    InvalidTier,
    #[msg("Not the position owner")]
    NotOwner,
    #[msg("Position is empty")]
    EmptyPosition,
    #[msg("Lock period has not expired")]
    StillLocked,
    #[msg("Duration must be greater than zero")]
    ZeroDuration,
}
