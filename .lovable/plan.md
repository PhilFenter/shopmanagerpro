
# Complete Shop Management System - React Rebuild

## Overview
A comprehensive production tracking and recipe documentation system for a custom decoration shop. Built with React and Supabase backend for multi-user collaboration, mobile-first experience, and reliable cloud storage. Integrates with **Printavo** and **Shopify** for pulling orders (including customer contact info), with built-in **SMS/email notifications** to customers.

**Core Purpose:** Track time, understand costs, document "recipes" for consistent repeat work, and eliminate re-inventing the wheel on re-orders.

---

## Phase 1: Foundation & Authentication

### User Authentication
- Email/password login with role-based access
- **Admin users:** Full access including overhead, team management, and financial settings
- **Team users:** Can work with jobs and production modules, restricted from financial data

### Dashboard
- Today's active jobs
- Monthly break-even progress tracker
- Quick-add job button
- Recent activity feed
- Sync status across devices

---

## Phase 2: Core Job Tracking

### Job Management
- Link to **invoice/order number** (for pulling previous work on re-orders)
- Customer name, phone, email (pulled from Shopify/Printavo)
- Service type selection
- Quantity and sale price
- **Time tracking** with Start/Stop/Pause timer
- Material cost entry
- Automatic calculations: Labor, overhead allocation, profit margin

### Photo Documentation
- **Attach photos to jobs by invoice/order number**
- Camera integration for quick capture on shop floor
- Photo gallery per job for future reference
- Easy retrieval when duplicating orders ("show me what we did last time")

### Job Templates ("Recipes")
- Save any completed job as a template
- Organized by service type and customer
- One-click job creation from template (preserves all settings + photos)
- Perfect for repeat orders

---

## Phase 3: Production Modules

### Embroidery Module (Barudan 15-Needle)
- Visual 15-needle position grid
- **Madeira thread** color assignment per needle
- Hoop size selection
- Placement tracking (Left Chest, Back, Cap, etc.)
- Stitch count and design file reference
- Photo documentation of final product
- Save as embroidery recipe

### ROQ Screen Print Module (P14XL Auto Press)
- Print type: Single vs Multi-rotation
- 12-position platen mapping with visual grid
- Multi-rotation sequence builder
- Ink, mesh, squeegee settings
- Flash/cure settings
- Quality rating for future reference
- Production notes + photos
- Save as screen print recipe

### DTF Module (Direct to Film)
- **Heat press settings by fabric type**
  - Cotton: Time, temperature, pressure
  - Polyester: Adjusted settings to prevent dye migration
  - Blends and specialty fabrics
- Fabric type quick-select with preset settings
- Notes for special handling
- Photo of finished product
- Save as DTF recipe

### Leather Patch Module (Trotec Laser)
- Material types: Chestnut varieties, Black, Leatherettes
- Laser settings: Power, Speed, Frequency, Passes
- Patch dimensions and quantity
- Material cost tracking
- Photo documentation
- Save as leather recipe

---

## Phase 4: Business Operations (Admin Only)

### Team Management
- Add/edit team members
- Hourly rate or salary setup
- Weekly hours tracking
- **16.5% payroll tax burden** calculation (built-in)

### Overhead Tracking
- Fixed costs: Rent, Insurance, Equipment
- Variable costs: Utilities, Supplies, Maintenance
- Monthly total calculation
- **Hourly overhead rate** for job allocation

### Financial Dashboard
- Monthly revenue vs costs
- **Break-even tracker** with visual progress
- Profit margin by service type
- Job profitability analysis

---

## Phase 5: Integrations & Notifications

### Printavo Integration
- **Pull jobs/quotes from Printavo** to avoid re-typing
- Import customer name, phone, email, job details, quantities
- Jobs populate automatically - then add production tracking and time
- Printavo stays your quote/invoice system

### Shopify Integration
- **Pull orders from Shopify** to create jobs
- Import customer name, phone, email, order details
- Order data populates job fields automatically

### Customer Notifications (Text/Email)
- **One-click SMS or email when job status changes**
- Status workflow: Order Received → In Production → Ready for Pickup
- Contact info already there from Shopify/Printavo import
- Customizable message templates
- Notification history per job

---

## Phase 6: Mobile & Real-Time Sync

### Mobile Experience
- Fully responsive for phones and tablets
- Touch-friendly timers and controls
- Quick photo capture from device camera
- Works great on the shop floor

### Multi-User Collaboration
- Real-time updates across all devices
- Multiple team members working simultaneously
- Live sync - no refresh needed
- Automatic cloud backup (no more Firebase worries)

---

## Technical Approach

### Frontend
- React with TypeScript
- Mobile-first responsive design
- Touch-optimized for shop floor use

### Backend (Lovable Cloud)
- Supabase database with automatic backups
- Real-time sync between users
- Secure photo storage
- SMS via Twilio
- Email via Resend
- API integrations with Printavo and Shopify

### Build Order
1. Auth + Dashboard + Core Job Tracking
2. Photo capture and storage
3. Production modules (Embroidery → ROQ → DTF → Leather)
4. Team/Overhead management
5. Printavo integration (pull jobs)
6. Shopify integration (pull orders with contact info)
7. SMS/Email notification system
