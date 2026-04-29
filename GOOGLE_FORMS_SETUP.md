# Google Forms Setup Guide for Email Subscriptions

## Step 1: Create a Google Form

1. Go to [Google Forms](https://forms.google.com)
2. Click "Blank" to create a new form
3. Set the title to "Overvibing Email Subscription"
4. Add a description: "Subscribe to get notified about weekly Overvibing meetings and updates"

## Step 2: Add Form Fields

### Email Field (Required)
1. Click "Add question" (+ button)
2. Select "Short answer" type
3. Set the question title to "Email Address"
4. Make it required by toggling the "Required" switch
5. Click the three dots (...) and select "Response validation"
6. Choose "Email address" as the validation type

### Project Field (Optional)
1. Click "Add question" (+ button)
2. Select "Short answer" type
3. Set the question title to "What do you want to build?"
4. Leave it as optional (don't toggle Required)

### Source Field (Optional)
1. Click "Add question" (+ button)
2. Select "Multiple choice" type
3. Set the question title to "How did you hear about us?"
4. Add these options:
   - Social Media
   - Friend/Colleague
   - Search Engine
   - GitHub
   - ONE-FRONT Website
   - Other
5. Leave it as optional (don't toggle Required)

## Step 3: Get Form Configuration

1. Click the "Send" button (top right)
2. Click the link icon to get the form URL
3. Copy the form URL - it looks like: `https://docs.google.com/forms/d/e/1FAIpQLSd.../formResponse`

## Step 4: Get Entry IDs

You need to get the entry ID for each field:

### Email Field Entry ID
1. Right-click on the email field and select "Inspect Element"
2. Look for the `name` attribute in the input field
3. It will look like: `name="entry.1234567890"`
4. Copy the entry ID (the number part): `1234567890`

### Project Field Entry ID
1. Right-click on the "What do you want to build?" field and select "Inspect Element"
2. Look for the `name` attribute in the input field
3. Copy the entry ID (the number part): `9876543210`

### Source Field Entry ID
1. Right-click on the "How did you hear about us?" field and select "Inspect Element"
2. Look for the `name` attribute in the select field
3. Copy the entry ID (the number part): `5555555555`

## Step 5: Update Your Code

Replace the placeholder values in `src/script.js`:

```javascript
// Replace these lines in the initializeEmailSubscription function:
const GOOGLE_FORM_ACTION = 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse';
const GOOGLE_FORM_ENTRY_IDS = {
    email: 'entry.YOUR_EMAIL_ENTRY_ID',
    project: 'entry.YOUR_PROJECT_ENTRY_ID', 
    source: 'entry.YOUR_SOURCE_ENTRY_ID'
};

// With your actual values:
const GOOGLE_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSd.../formResponse';
const GOOGLE_FORM_ENTRY_IDS = {
    email: 'entry.1234567890',
    project: 'entry.9876543210', 
    source: 'entry.5555555555'
};
```

## Step 6: Update the submitToGoogleForms Function

The function is already updated in your code to handle all three fields:

```javascript
async function submitToGoogleForms(email, project, source) {
    const formData = new FormData();
    formData.append(GOOGLE_FORM_ENTRY_IDS.email, email);
    
    // Add optional fields if they have values
    if (project) {
        formData.append(GOOGLE_FORM_ENTRY_IDS.project, project);
    }
    if (source) {
        formData.append(GOOGLE_FORM_ENTRY_IDS.source, source);
    }
    
    const response = await fetch(GOOGLE_FORM_ACTION, {
        method: 'POST',
        mode: 'no-cors', // Required for Google Forms
        body: formData
    });
    
    // Note: Due to CORS, we can't check the response status
    // But if no error is thrown, we assume success
    return Promise.resolve();
}
```

## Step 7: Test the Integration

1. Build and deploy your site
2. Try submitting an email through the form
3. Check your Google Form responses to confirm emails are being collected

## Step 8: Set Up Email Notifications (Optional)

1. In Google Forms, click the "Responses" tab
2. Click the three dots (...) next to "Responses"
3. Select "Get email notifications for new responses"
4. Enter your email address

## Step 9: Export Data (Optional)

1. In the "Responses" tab, click the Google Sheets icon
2. This will create a spreadsheet with all email submissions
3. You can use this for email marketing campaigns

## Alternative: Use Google Sheets API (Advanced)

If you want more control, you can use the Google Sheets API directly:

1. Create a Google Sheet
2. Set up the Google Sheets API
3. Use the API to write emails directly to the sheet
4. This requires more setup but gives you more control

## Troubleshooting

- **CORS errors**: Make sure you're using `mode: 'no-cors'` in the fetch request
- **Form not submitting**: Check that the form action URL and entry ID are correct
- **Emails not appearing**: Verify the form is set to accept responses and check the Responses tab

## Security Notes

- Google Forms automatically handles spam protection
- No sensitive data is stored on your server
- All data is stored securely in Google's infrastructure
- You can set up form restrictions if needed (login required, etc.)
