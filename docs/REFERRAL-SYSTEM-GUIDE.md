# 📚 Complete Referral System Guide

## Overview
The referral system allows sellers/affiliates to promote the Master Course with personalized discount codes. Customers get discounts, and sellers earn commissions.

## 🎯 How It Works

### For Administrators

#### 1. Creating a New Seller/Affiliate

Run the management script:
```bash
cd DayTradeDakApi
node scripts/manage-affiliates.js
```

Select option 1 and enter:
- **Affiliate Code**: Unique code (e.g., `MARIA2024`, `PEDRO15`)
- **Name**: Seller's full name
- **Email**: Seller's email
- **Phone**: Optional phone number
- **Discount %**: How much discount customers get (e.g., 10 for 10%)
- **Commission %**: How much commission seller earns (e.g., 5 for 5%)

#### 2. Important Values Explained

**Discount Percentage**
- This is what customers save
- Example: 10% = $300 off on $3,000 course
- Recommended: 10-20%

**Commission Rate**
- This is what seller earns from final price
- Example: 5% of $2,700 (after discount) = $135
- Recommended: 3-8%

#### 3. Managing Affiliates

Use the script menu to:
- **List all affiliates**: See all codes and their stats
- **View statistics**: Check specific seller performance
- **Toggle status**: Activate/deactivate codes
- **Update rates**: Change discount or commission

### For Sellers

#### What Sellers Need to Know

1. **Their unique code** (e.g., `MARIA2024`)
2. **The discount amount** (e.g., 10% off)
3. **Their commission rate** (e.g., 5% per sale)
4. **How to share it** with customers

#### Seller Instructions

Tell your sellers:
```
"Share your code MARIA2024 with potential customers.
They get 10% off the Master Course.
You earn $135 commission for each sale.
Track your sales anytime by contacting admin."
```

### For Customers

#### How Customers Use Referral Codes

1. **Visit Master Course page**
   - Go to: `https://yourdomain.com/master-course`

2. **Click "Register Now"**
   - Opens registration modal

3. **Fill registration form**
   - First name, last name
   - Email, phone
   - Trading experience (optional)

4. **Enter Referral Code**
   - Find "Referral Code (Optional)" field
   - Enter code: `MARIA2024`
   - Click "Apply"

5. **See Discount Applied**
   - Original price: ~~$2,999.99~~
   - Your price: **$2,699.99**
   - You save: **$300.00!**

6. **Complete Payment**
   - Click "Pay Now"
   - Enter card details in Stripe
   - Complete purchase

## 💰 Price Calculation Examples

### Example 1: Standard Discount (10%)
```
Original Price:     $2,999.99
Referral Code:      MARIA2024 (10% off)
Discount Amount:    -$300.00
Customer Pays:      $2,699.99
Seller Commission:  $135.00 (5% of $2,699.99)
```

### Example 2: Premium Discount (20%)
```
Original Price:     $2,999.99
Referral Code:      VIP20 (20% off)
Discount Amount:    -$600.00
Customer Pays:      $2,399.99
Seller Commission:  $192.00 (8% of $2,399.99)
```

### Example 3: Small Discount (5%)
```
Original Price:     $2,999.99
Referral Code:      FRIEND5 (5% off)
Discount Amount:    -$150.00
Customer Pays:      $2,849.99
Seller Commission:  $85.50 (3% of $2,849.99)
```

## 📊 Tracking & Reports

### For Administrators

#### View All Sales
```bash
node scripts/manage-affiliates.js
# Select option 2 (List all affiliates)
```

Shows:
- Total sales per affiliate
- Total revenue generated
- Commission owed
- Active/inactive status

#### View Specific Seller Stats
```bash
node scripts/manage-affiliates.js
# Select option 3 (View affiliate statistics)
# Enter code: MARIA2024
```

Shows:
- Total sales count
- Total revenue
- Total commission earned
- Average sale value

### For Sellers

Sellers can request their stats by:
1. Contacting admin
2. Using the affiliate portal (if built)
3. Receiving monthly reports

## 🔧 System Configuration

### Current Settings

**Test Affiliates Available:**
- `TEST123` - 10% discount, 5% commission
- `PREMIUM20` - 20% discount, 8% commission

### Recommended Configurations

**For Regular Sellers:**
- Discount: 10-15%
- Commission: 4-6%

**For Top Performers:**
- Discount: 15-20%
- Commission: 6-8%

**For Special Promotions:**
- Discount: 20-25%
- Commission: 3-5%

## ⚠️ Important Notes

1. **Codes are case-insensitive**
   - `maria2024` = `MARIA2024` = `Maria2024`

2. **One code per transaction**
   - Customers can only use one referral code

3. **Instant validation**
   - System checks code immediately
   - Shows error if invalid

4. **No retroactive discounts**
   - Code must be applied before payment

5. **Commission tracking**
   - Automatic after successful payment
   - Stored in database
   - Can export for accounting

## 🚀 Quick Start Guide

### Step 1: Create Your First Affiliate
```bash
cd DayTradeDakApi
node scripts/manage-affiliates.js
# Choose option 1
# Enter: SELLER001, John Doe, john@email.com, 10, 5
```

### Step 2: Test the Code
1. Open browser to Master Course page
2. Click Register
3. Enter code `SELLER001`
4. See 10% discount applied

### Step 3: Check Results
```bash
node scripts/manage-affiliates.js
# Choose option 3
# Enter: SELLER001
# See stats
```

## 📞 Support

For issues or questions:
1. Check affiliate status is active
2. Verify code exists in system
3. Check customer entered code correctly
4. Review commission calculations

## 🎯 Best Practices

1. **Choose memorable codes**
   - Good: `MARIA2024`, `TRADEPRO`
   - Bad: `XK29B1Q`, `123456`

2. **Set fair rates**
   - Balance customer savings with seller incentive
   - Don't exceed 25% total (discount + commission)

3. **Track performance**
   - Review monthly
   - Reward top performers
   - Deactivate unused codes

4. **Communicate clearly**
   - Give sellers marketing materials
   - Explain the process
   - Provide regular updates

---

**System Status:** ✅ ACTIVE AND READY
**Current Affiliates:** 2 active codes
**Total Possible Discount:** Up to 25%
**Commission Range:** 3-10%