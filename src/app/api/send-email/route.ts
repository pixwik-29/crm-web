import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required parameters: to, subject, html' },
        { status: 400 }
      );
    }

    const host = process.env.SMTP_HOST || 'smtp.zoho.com';
    const port = parseInt(process.env.SMTP_PORT || '465');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      return NextResponse.json(
        { error: 'SMTP credentials not configured in environment variables' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for port 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    let updatedHtml = html;
    updatedHtml = updatedHtml.replace(
      /<h2 style="color:\s*#0176d3;\s*font-size:\s*20px;\s*font-weight:\s*bold;\s*margin-bottom:\s*20px;">Welcome to Perfect Scholar Partner Portal!<\/h2>/gi,
      '<img src="cid:logo" alt="Perfect Scholar Logo" style="height: 35px; width: auto; display: block; margin: 0 auto 20px auto;" />'
    );
    updatedHtml = updatedHtml.replace(
      /<h2 style="color:\s*#[0-9a-fA-F]+;\s*margin:\s*0;\s*font-size:\s*24px;\s*font-weight:\s*800;">Perfect Scholar CRM<\/h2>/gi,
      '<img src="cid:logo" alt="Perfect Scholar Logo" style="height: 35px; width: auto; display: block; margin: 0 auto 20px auto;" />'
    );
    updatedHtml = updatedHtml.replace(
      /<h2 style="color:\s*#[0-9a-fA-F]+;\s*margin:\s*0;\s*font-size:\s*24px;\s*font-weight:\s*800;">Perfect Scholar Partner Portal<\/h2>/gi,
      '<img src="cid:logo" alt="Perfect Scholar Logo" style="height: 35px; width: auto; display: block; margin: 0 auto 20px auto;" />'
    );

    const info = await transporter.sendMail({
      from: `"Perfect Scholar" <${user}>`,
      to,
      subject,
      html: updatedHtml,
      attachments: [{
        filename: 'logo.png',
        path: require('path').join(process.cwd(), 'public/logo.png'),
        cid: 'logo'
      }]
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
