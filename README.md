# 🚚 Srimalli Food Product — Delivery Tracking System

> A lightweight, secure, mobile-first delivery management and customer order-tracking platform built for **Srimalli Food Product**.

[![React](https://img.shields.io/badge/React-18%2B-61DAFB?logo=react\&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-3178C6?logo=typescript\&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7%2B-646CFF?logo=vite\&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase\&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3%2B-06B6D4?logo=tailwindcss\&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Live Application:**
https://divakar07-pixel.github.io/Srimalli_Delivery_Tracking/

---

## 📌 Overview

**Srimalli Delivery Tracking** is a delivery management system designed specifically for the operational workflow of **Srimalli Food Product**.

The system allows an administrator to:

* Create and manage customer orders
* Upload and review invoices
* Track order status
* Manage delivery information
* Generate customer tracking references
* Share order updates through WhatsApp
* Monitor delivery progress from a central dashboard

Customers do not need to create an account.

They can simply use their **mobile number or invoice/order reference** to view their order and delivery timeline.

### 🎯 Design Philosophy

This application is intentionally designed for a **small-business delivery workflow**, rather than a large courier or fleet-management platform.

It currently operates around:

* One business
* One delivery hub
* One delivery person
* Admin-controlled order management
* Customer self-service tracking

There are **no driver accounts, driver bidding, fleet assignment, or complex courier-management features**.

---

## ✨ Key Features

### 👤 Customer Tracking

Customers can track their orders without logging in.

* Search using mobile number or invoice/order reference
* View multiple orders associated with a mobile number
* View delivery status
* View delivery timeline
* View order information
* Access invoice securely
* No customer account required

---

### 📦 Order Management

Administrators can create and manage orders from the admin panel.

**Order creation supports:**

* Manual entry
* Bill/invoice image upload
* PDF invoice upload
* Multiple products per order
* Custom product names
* Quantity and price calculation
* Editable invoice totals
* Customer information
* Delivery notes
* Expected delivery information

The system does not depend on a predefined product catalogue.

---

### 🧾 Invoice Management

Invoices can be attached directly to orders.

Supported formats include:

* JPG
* PNG
* WEBP
* PDF

Invoices are stored inside a **private Supabase Storage bucket**.

Customers never receive direct public access to the storage bucket.

---

### 📍 Delivery Timeline

Every order follows a clear delivery lifecycle:

```text
Order Created
      ↓
Supplier Dispatched
      ↓
Arrived at Hub
      ↓
Out for Delivery
      ↓
Delivered
```

Orders can also be marked:

```text
Cancelled
```

Every status change is recorded with a timestamp and displayed through the customer tracking timeline.

---

### 📱 WhatsApp Integration

The system provides WhatsApp click-to-chat functionality without requiring a paid WhatsApp API.

Administrators can:

* Generate status-specific messages
* Edit messages before sending
* Open WhatsApp directly
* Contact customers from the order page

The system uses the standard:

```text
wa.me
```

click-to-chat mechanism.

---

### 📊 Admin Dashboard

The dashboard provides an operational overview of current orders.

Includes:

* Order statistics
* Status counts
* Today's orders
* Quick actions
* Recent activity
* Order management shortcuts

---

### 🔎 Advanced Order Search

Administrators can search and filter orders using:

* Order/invoice reference
* Customer information
* Delivery status
* Date
* Pagination

---

### ⚙️ Settings

Business settings can be managed from the admin panel.

Includes:

* Company name
* Company logo
* Business contact information
* WhatsApp message templates
* Theme settings

---

### 📱 Mobile-First Design

The application is designed for use from both desktop and mobile devices.

Mobile experience includes:

* Responsive layouts
* Mobile navigation
* Camera-based invoice capture
* Touch-friendly controls
* PWA support

---

## 🔐 Security Architecture

Security is a major part of the application's architecture.

### Row Level Security

Supabase PostgreSQL uses **Row Level Security (RLS)** to protect application data.

Administrative database operations are restricted to authenticated users with the appropriate admin role.

### Public Tracking

Customer tracking does **not** expose direct database access.

Instead, public tracking uses restricted RPC functions that expose only the information required by the tracking interface.

Sensitive information such as:

* Full customer mobile numbers
* Customer addresses
* Internal database records

is not exposed through the public tracking interface.

### Private Invoice Storage

Invoices are stored in a private storage bucket.

Customer invoice access follows this flow:

```text
Customer
   ↓
Tracking Reference
   ↓
Edge Function
   ↓
Reference Verification
   ↓
Signed URL
   ↓
Private Invoice
```

The Edge Function verifies the order reference before generating a temporary signed URL.

### ⚠️ Environment Variables

Never commit sensitive credentials to GitHub.

Frontend environment variables should contain only the Supabase project URL and public/publishable key.

**Never expose:**

```text
SUPABASE_SERVICE_ROLE_KEY
```

inside frontend code.

---

# 🛠️ Technology Stack

| Layer           | Technology              |
| --------------- | ----------------------- |
| Frontend        | React + TypeScript      |
| Build Tool      | Vite                    |
| Styling         | Tailwind CSS            |
| Routing         | React Router            |
| Forms           | React Hook Form + Zod   |
| UI Icons        | Lucide                  |
| Animations      | Framer Motion           |
| Backend         | Supabase                |
| Database        | PostgreSQL              |
| Authentication  | Supabase Auth           |
| Storage         | Supabase Storage        |
| Server Logic    | Supabase Edge Functions |
| Hosting         | GitHub Pages / Vercel   |
| Version Control | Git + GitHub            |

---

# 🏗️ Architecture

```text
                    ┌─────────────────────┐
                    │      Customer       │
                    │  Mobile / Desktop   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Public Tracking   │
                    │   React + Vite      │
                    └──────────┬──────────┘
                               │
                         Restricted RPC
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Supabase       │
                    │    PostgreSQL       │
                    └─────────────────────┘


                    ┌─────────────────────┐
                    │       Admin         │
                    │  Authenticated User │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Admin Portal     │
                    │ React + TypeScript  │
                    └──────────┬──────────┘
                               │
                               ▼
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
       PostgreSQL          Storage          Edge Functions
         + RLS            Invoices         Secure Access
```

---

# 📂 Project Structure

```text
src/
├── components/
│   ├── orders/
│   ├── tracking/
│   ├── invoices/
│   └── layout/
│
├── pages/
│   ├── public/
│   │   ├── Landing
│   │   ├── Track
│   │   └── TrackDetail
│   │
│   └── admin/
│       ├── Login
│       ├── Dashboard
│       ├── Orders
│       ├── OrderDetail
│       ├── AddOrder
│       └── Settings
│
├── services/
│   ├── orders
│   ├── invoices
│   ├── tracking
│   ├── auth
│   ├── settings
│   ├── whatsapp
│   └── ocr
│
├── hooks/
├── types/
└── constants/

supabase/
├── migrations/
│   ├── 0001_schema
│   ├── 0002_rls
│   ├── 0003_tracking_rpcs
│   ├── 0004_storage
│   └── 0005_admin_profiles_and_hardened_rls
│
├── functions/
│   └── get-invoice-url/
│
├── VERIFY_DATABASE.sql
└── FIRST_ADMIN_SETUP.sql
```

---

# 🚀 Getting Started

## Prerequisites

Install the following:

* Node.js 22+
* npm
* Supabase account
* Supabase CLI

Install Supabase CLI:

```bash
npm install -g supabase
```

---

## 1. Clone the Repository

```bash
git clone https://github.com/Divakar07-pixel/Srimalli_Delivery_Tracking.git

cd Srimalli_Delivery_Tracking
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-or-anon-key
```

Do not commit `.env` to GitHub.

---

# 🗄️ Supabase Setup

Create a new Supabase project.

Then link the local project:

```bash
supabase login

supabase link --project-ref <project-ref>
```

Run the database migrations:

```bash
supabase db push
```

Migrations should be executed in order:

```text
0001 → 0002 → 0003 → 0004 → 0005
```

For manual setup, the migration files can also be executed from:

**Supabase Dashboard → SQL Editor**

---

# 👨‍💼 Create the First Admin

Create the initial user through:

**Supabase Dashboard → Authentication → Users**

After creating the Auth user, run:

```text
supabase/FIRST_ADMIN_SETUP.sql
```

with the required placeholders configured.

The application intentionally does not provide public signup.

---

# 📄 Invoice Edge Function

Deploy the invoice access function:

```bash
supabase functions deploy get-invoice-url
```

The function:

1. Receives an order reference
2. Validates the order
3. Verifies invoice ownership/reference
4. Generates a signed URL
5. Returns temporary access to the invoice

---

# ▶️ Run Locally

Start the development server:

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:5173
```

Admin login:

```text
http://localhost:5173/admin/login
```

---

# 🧪 Development Commands

```bash
npm run dev
```

Start development server.

```bash
npm run lint
```

Run ESLint.

```bash
npm run typecheck
```

Run TypeScript checks.

```bash
npm run build
```

Create production build.

```bash
npm run preview
```

Preview the production build locally.

---

# 🤖 OCR / Bill Scanning

The application includes the complete bill-scanning workflow architecture.

The workflow supports:

```text
Upload / Capture Bill
        ↓
Scanning
        ↓
OCR Processing
        ↓
Review Extracted Data
        ↓
Edit if Required
        ↓
Save Order
```

If OCR fails:

```text
OCR Failure
     ↓
Manual Entry
```

The manual-entry option is always available.

### Current OCR Architecture

The frontend contains the OCR integration layer, but a production OCR provider is not required for the application to operate.

A provider such as:

* Google Cloud Vision
* AWS Textract
* An LLM vision API
* Another OCR service

can be connected through a Supabase Edge Function.

API credentials should remain server-side.

---

# 🌐 Deployment

## GitHub Pages

The repository includes a GitHub Actions deployment workflow.

In GitHub:

```text
Repository
   ↓
Settings
   ↓
Pages
   ↓
Source: GitHub Actions
```

Configure repository secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

The GitHub Pages build uses:

```text
/Srimalli_Delivery_Tracking/
```

as its base path.

### Important

GitHub Pages is static hosting and does not provide SPA server-side route rewriting.

Therefore, direct refreshes of nested routes such as:

```text
/admin/orders
```

may not work correctly on GitHub Pages.

For complete SPA deep-link support, Vercel is recommended.

---

# ▲ Vercel Deployment

Import the GitHub repository into Vercel.

Use:

```text
Framework: Vite
```

Configure:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not expose service-role credentials.

The included `vercel.json` handles SPA route rewriting.

---

# 🔄 Production Verification

Before deploying:

```bash
npm ci

npm run lint

npm run typecheck

npm run build
```

Optional GitHub Pages build verification:

```bash
VITE_DEPLOY_TARGET=github-pages npm run build
```

---

# 🗃️ Database Schema

| Table                  | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `customers`            | Customer information including name, mobile and address     |
| `orders`               | Main order records, status, totals and tracking information |
| `order_items`          | Products and quantities belonging to each order             |
| `invoices`             | Invoice metadata and storage references                     |
| `order_status_history` | Historical record of order status changes                   |
| `settings`             | Business configuration and WhatsApp templates               |
| `profiles`             | Authenticated admin profile and role information            |

---

# 🔐 Security Model

```text
                 Public User
                     │
                     ▼
              Tracking Interface
                     │
                     ▼
            Restricted RPC Functions
                     │
                     ▼
               Masked Data
```

Administrative users:

```text
                 Admin
                   │
                   ▼
              Supabase Auth
                   │
                   ▼
            Admin Role Check
                   │
                   ▼
              RLS Policies
                   │
                   ▼
             Protected Tables
```

Invoice access:

```text
Customer
   │
   ▼
Order Reference
   │
   ▼
Edge Function
   │
   ▼
Validation
   │
   ▼
Signed URL
   │
   ▼
Private Storage
```

---

# 📱 Progressive Web App

The application is structured as a PWA and supports installation on compatible devices.

Required icons:

```text
public/icons/
├── icon-192.png
├── icon-512.png
└── maskable-512.png
```

Generate production icons from the official Srimalli Food Product logo before deployment.

---

# 🛠️ Troubleshooting

### Missing Supabase environment variables

Check:

```text
.env
```

and restart the development server after changing environment variables.

---

### Tracking returns "No matching orders"

Verify:

```text
0002 RLS migration
0003 Tracking RPC migration
```

were successfully applied.

Public tracking intentionally does not have unrestricted table access.

---

### Invoice cannot be retrieved

Check:

```bash
supabase functions logs get-invoice-url
```

Also verify:

* Edge Function is deployed
* Invoice exists
* Invoice reference is correct
* Storage bucket exists

---

### Admin login does not work

Verify that the user exists under:

```text
Supabase
→ Authentication
→ Users
```

Then verify the user's admin profile/role.

---

### Vercel route returns 404

Confirm:

* Vercel framework is set to **Vite**
* `vercel.json` exists in the repository root
* The latest commit was deployed

---

# 📈 Future Improvements

Potential future enhancements include:

* 📍 Customer location sharing
* 🗺️ Google Maps navigation integration
* 🚚 Live delivery location tracking
* 📲 Push notifications
* 🤖 Production OCR integration
* 📊 Advanced delivery analytics
* 📦 Product inventory management
* 🧾 Automated invoice generation
* 💬 Automated WhatsApp Business integration
* 📱 Enhanced PWA offline capabilities

These features are intentionally separate from the current small-business workflow.

---

# 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

### Development Workflow

```bash
git checkout -b feature/your-feature

npm install

npm run lint

npm run typecheck

npm run build
```

Commit your changes:

```bash
git add .

git commit -m "feat: add your feature"
```

Push the branch:

```bash
git push origin feature/your-feature
```

Then open a Pull Request.

---

# 📄 License

This project is licensed under the **MIT License**.

See [`LICENSE`](LICENSE) for details.

---

# 👨‍💻 Author

**Divakar R**

GitHub:
https://github.com/Divakar07-pixel

Portfolio:
https://divakar07-pixel.github.io/Portfolio/

---

# ⭐ Project

If you find this project useful, consider giving the repository a ⭐ on GitHub.

**Srimalli Food Product — Delivery Tracking System**

Built with ❤️ using React, TypeScript, Vite and Supabase.
