# Authentication Setup Guide

## Overview
This backend implements a comprehensive email-based authentication system with JWT tokens, email verification, and route protection.

## Features
- User registration with email verification
- Secure login with JWT tokens stored in httpOnly cookies
- Password reset functionality
- Rate limiting for security
- Route protection middleware
- User-specific data access control

## Setup Instructions

### 1. Environment Variables
Copy `.env.example` to `.env` and configure the following variables:

```bash
cp .env.example .env
```

#### Required Variables:
- `JWT_SECRET`: A strong secret key for JWT token signing (use a random 256-bit key)
- `MONGODB_URI`: MongoDB connection string
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`: Email service configuration
- `BASE_URL`: Backend URL for email links
- `FRONTEND_URL`: Frontend URL for CORS and redirects

#### Email Configuration Options:

**Gmail Setup:**
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password: Account → Security → App passwords
3. Use the App Password as `EMAIL_PASS`

**Other Email Providers:**
- Update `EMAIL_HOST` and `EMAIL_PORT` accordingly
- For example, Outlook: `smtp-mail.outlook.com:587`

### 2. Generate JWT Secret
Use a secure random string for `JWT_SECRET`. You can generate one using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Database Migration
The authentication system adds a `user` field to existing orders. For existing data, you may need to run a migration script.

## API Endpoints

### Authentication Routes
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/verify-email?token=xxx` - Verify email address
- `POST /auth/resend-verification` - Resend verification email
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user info
- `POST /auth/forgot-password` - Send password reset email
- `POST /auth/reset-password` - Reset password

### Protected Routes
All order and quote routes now require authentication:
- `GET /order/` - Get user's orders (paginated)
- `POST /order/` - Create new order
- `GET /order/orderId/:uid` - Get specific order (user's own only)
- `GET /quote/:uuid/...` - Get quote for order (user's own only)

### Public Routes
Price routes remain public but track usage:
- `GET /price/chain/:inChain/token/:inToken/currency/`
- `GET /price/get-required-token-amount/...`

## Security Features

### Rate Limiting
- Authentication routes: 5 attempts per 15 minutes
- Verification emails: 3 requests per hour
- Password reset: 3 requests per hour

### Cookie Security
- HttpOnly cookies prevent XSS attacks
- Secure flag in production
- SameSite protection against CSRF
- 7-day expiration

### Data Protection
- Users can only access their own orders
- Email verification required for sensitive operations
- Password hashing with bcrypt (12 rounds)
- JWT tokens with secure expiration

## Usage Examples

### Registration
```javascript
const response = await fetch('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123',
    confirmPassword: 'securePassword123'
  })
});
```

### Login
```javascript
const response = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123'
  })
});
```

### Making Authenticated Requests
```javascript
const response = await fetch('/order/', {
  method: 'GET',
  credentials: 'include', // Include cookies
});
```

## Error Handling

### Common Error Responses:
- `401 Unauthorized`: No token provided or invalid token
- `403 Forbidden`: Valid token but insufficient permissions
- `400 Bad Request`: Validation errors or missing fields
- `429 Too Many Requests`: Rate limit exceeded

### Error Response Format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

## Development vs Production

### Development:
- Detailed error messages included
- Console logging enabled
- Less strict cookie security

### Production:
- Error details hidden from client
- Secure cookie flags enabled
- CORS restricted to specific origins

## Testing

### Manual Testing:
1. Register a new user
2. Check email for verification link
3. Click verification link
4. Login with verified credentials
5. Access protected routes
6. Test logout functionality

### Email Testing:
For development, consider using services like:
- Mailtrap.io for email testing
- Gmail with App Passwords
- Local SMTP server (Mailhog, MailCatcher)

## Troubleshooting

### Common Issues:

1. **Email not sending:**
   - Check EMAIL_* environment variables
   - Verify email service credentials
   - Check firewall/network restrictions

2. **JWT errors:**
   - Ensure JWT_SECRET is set and consistent
   - Check token expiration
   - Verify cookie settings

3. **CORS issues:**
   - Configure FRONTEND_URL correctly
   - Ensure credentials: 'include' in frontend requests
   - Check browser security policies

4. **Database errors:**
   - Verify MongoDB connection
   - Check user permissions
   - Ensure indexes are created