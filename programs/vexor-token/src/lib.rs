use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

declare_id!("6ucEAsCM4jwtYgTE3xAxgb6R5RwwAxzCaLCCaYtUnXrM");

/// Vexor Token ($VEXOR) — SPL mint with devnet faucet.
///
/// On devnet the `claim` instruction lets any wallet receive a one-time drop
/// of 1 000 $VEXOR so they can exercise staking + governance. The authority
/// can mint additional supply for liquidity / staking rewards via `mint_to`.
///
/// On mainnet the faucet PDA is never initialised and mint authority is burned
/// after the initial treasury mint.
#[program]
pub mod vexor_token {
    use super::*;

    pub const FAUCET_AMOUNT: u64 = 1_000_000_000_000; // 1 000 tokens (9 decimals)
    pub const INITIAL_SUPPLY: u64 = 10_000_000_000_000_000; // 10 000 000 tokens

    /// Initialise the token mint and mint the initial treasury supply to the
    /// authority's associated token account.
    pub fn initialize(ctx: Context<Initialize>, decimals: u8) -> Result<()> {
        let treasury_amount = INITIAL_SUPPLY;

        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            treasury_amount,
        )?;

        msg!(
            "vexor_token: initialized mint {} with {} to treasury",
            ctx.accounts.mint.key(),
            treasury_amount
        );
        Ok(())
    }

    /// One-time devnet faucet. Each wallet can claim once.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let faucet = &mut ctx.accounts.faucet;
        require!(!faucet.claimed, VexorTokenError::AlreadyClaimed);

        faucet.claimed = true;
        faucet.user = ctx.accounts.user.key();

        let seeds: &[&[u8]] = &[b"mint-authority", &[ctx.bumps.mint_authority]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[seeds],
            ),
            FAUCET_AMOUNT,
        )?;

        emit!(FaucetClaimed {
            user: ctx.accounts.user.key(),
            amount: FAUCET_AMOUNT,
        });

        Ok(())
    }

    /// Authority-only mint for topping up staking rewards or liquidity.
    pub fn mint_to_account(ctx: Context<AuthMint>, amount: u64) -> Result<()> {
        require!(amount > 0, VexorTokenError::ZeroAmount);

        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(decimals: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        mint::decimals = decimals,
        mint::authority = authority,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub treasury: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// PDA that holds mint authority for faucet claims.
    /// CHECK: PDA seed verified by Anchor.
    #[account(seeds = [b"mint-authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + FaucetReceipt::INIT_SPACE,
        seeds = [b"faucet", user.key().as_ref()],
        bump,
    )]
    pub faucet: Account<'info, FaucetReceipt>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AuthMint<'info> {
    #[account(mut, mint::authority = authority)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct FaucetReceipt {
    pub user: Pubkey,
    pub claimed: bool,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct FaucetClaimed {
    pub user: Pubkey,
    pub amount: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum VexorTokenError {
    #[msg("Faucet already claimed by this wallet")]
    AlreadyClaimed,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
}
