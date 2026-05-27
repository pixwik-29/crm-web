import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, otp } = body;

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Missing required parameters: phone, otp' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SMS_API_KEY || '9cf5318f-903a-11ef-a4f5-e29d2b69142c';
    const templateId = process.env.SMS_TEMPLATE_ID || '1707177398599485291';
    const sender = process.env.SMS_SENDER || 'PFSCLR';

    // Format phone: strip non-digits and ensure country code 91 prefix
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    } else if (cleanPhone.startsWith('0')) {
      cleanPhone = '91' + cleanPhone.substring(1);
    }

    // Strict template text (registered DLT message)
    const message = `Your OTP for verification is ${otp}. It is valid for 1 minutes. Do not share this OTP with anyone. Use this code to validate your mobile number. - PerfectScholar`;
    const encodedMessage = encodeURIComponent(message);
    const routeType = 1; // 1-Transactional

    const apiUrl = `https://sapteleservices.com/SMS_API/sendsms.php?apikey=${apiKey}&mobile=${cleanPhone}&sendername=${sender}&message=${encodedMessage}&routetype=${routeType}&tid=${templateId}`;

    console.log(`Sending SMS to ${cleanPhone} using API...`);
    const response = await fetch(apiUrl, { method: 'GET' });
    const responseText = await response.text();

    console.log(`SMS Gateway Response: ${responseText}`);

    return NextResponse.json({ 
      success: true, 
      gatewayResponse: responseText 
    });
  } catch (error: any) {
    console.error('Error sending SMS OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS' },
      { status: 500 }
    );
  }
}
