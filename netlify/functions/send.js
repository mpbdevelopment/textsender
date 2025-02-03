// netlify/functions/send.js
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID; // If using a Messaging Service

// Initialize Twilio client
const client = twilio(accountSid, authToken);

/**
 * Helper function to convert a phone number from the format "(xxx) xxx-xxxx" to "+1xxxxxxxxxx".
 * Assumes US numbers.
 */
function convertToE164(phoneStr) {
  // Remove all non-digit characters
  const digits = phoneStr.replace(/\D/g, '');
  // Assuming US number (10 digits)
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  // If already in E.164 format or invalid, return as-is (or add further validation)
  return phoneStr;
}

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { phoneNumbers, message, schedule, scheduledTime } = data;

  // Basic validation
  if (!phoneNumbers || !message || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  const results = [];

  for (const phone of phoneNumbers) {
    const toNumber = convertToE164(phone);
    try {
      const msgParams = {
        body: message,
        messagingServiceSid: messagingServiceSid,
        to: toNumber,
      };

      // If scheduling is requested, convert the scheduled time.
      // The HTML datetime-local input returns a string like "YYYY-MM-DDTHH:mm"
      // Here we assume that this time is in Eastern Standard Time (EST, UTC-5).
      // Append "-05:00" so that JavaScript creates the correct Date.
      if (schedule && scheduledTime) {
        const scheduledTimeEST = scheduledTime + "-05:00";
        msgParams.sendAt = new Date(scheduledTimeEST).toISOString();
        msgParams.scheduleType = 'fixed';
      }

      await client.messages.create(msgParams);

      results.push({
        phone: phone,
        status: "success",
        message: schedule ? "Message scheduled (EST)." : "Message sent."
      });
    } catch (error) {
      console.error(`Error sending to ${phone}:`, error);
      results.push({
        phone: phone,
        status: "error",
        message: error.message || "Unknown error."
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(results)
  };
};
