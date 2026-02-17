# Supabase Setup Instructions

## Database Setup

### 1. Create Subscriptions Table

Run the SQL migration in your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/001_create_subscriptions_table.sql`
4. Click **Run** to execute the migration

This will create:
- `subscriptions` table with proper schema
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for automatic updates
- Functions for subscription management

### 2. Verify Table Creation

After running the migration, verify the table was created:

```sql
SELECT * FROM public.subscriptions LIMIT 1;
```

### 3. Test RLS Policies

Make sure RLS is working correctly:

```sql
-- This should only return subscriptions for the authenticated user
SELECT * FROM public.subscriptions;
```

## Table Schema

The `subscriptions` table includes:

- **id**: UUID primary key
- **user_id**: Foreign key to `auth.users`
- **tier**: Subscription tier (`free` or `premium`)
- **status**: Subscription status (`active`, `cancelled`, `expired`, `pending`, `past_due`)
- **started_at**: When the subscription started
- **expires_at**: When the subscription expires (NULL for lifetime subscriptions)
- **cancelled_at**: When the subscription was cancelled
- **auto_renew**: Whether the subscription auto-renews
- **payment_provider**: Payment provider name (e.g., 'stripe', 'paypal')
- **payment_provider_subscription_id**: External subscription ID
- **created_at**: Record creation timestamp
- **updated_at**: Last update timestamp

## Features

### Automatic Free Subscription
When a new user signs up, a free subscription is automatically created via the `on_auth_user_created` trigger.

### Active Subscription Lookup
The `get_user_active_subscription()` function retrieves the current active subscription for a user.

### Subscription Management
Use the functions in `src/lib/subscriptions.ts` to:
- Get active subscription
- Create new subscriptions
- Upgrade to premium
- Downgrade to free
- Cancel subscriptions

## Environment Variables

Make sure your `.env` file includes:

```env
VITE_SUPABASE_URL=https://btdsopwjneehifnzxfsk.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_bnCj3pb8WM--8IK-sWVwcA_G_nk2tVm
```

## Usage Example

```typescript
import { getActiveSubscription, upgradeToPremium } from './lib/subscriptions';

// Get current subscription
const subscription = await getActiveSubscription();

// Upgrade to premium
await upgradeToPremium();
```
