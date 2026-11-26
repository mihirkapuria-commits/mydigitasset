import React from 'react';
import { Shield, ArrowLeft, Download, FileText, Mail, Globe } from 'lucide-react';

interface PrivacyPolicySectionProps {
  onNavigateHome: () => void;
}

export const PrivacyPolicySection: React.FC<PrivacyPolicySectionProps> = ({ onNavigateHome }) => {
  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation & Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>

        {/* Document Card */}
        <div className="bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-8 sm:p-12 border-b border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold tracking-wider uppercase text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800">
                Official Compliance Document
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
              PRIVACY POLICY
            </h1>
            <p className="text-indigo-200 text-sm sm:text-base font-medium mb-4">
              For My Digit Asset (<a href="https://www.mydigitasset.com" target="_blank" rel="noreferrer" className="underline hover:text-white">https://www.mydigitasset.com</a>)
            </p>
            <div className="flex flex-wrap gap-y-2 gap-x-6 text-xs text-slate-400 border-t border-slate-800 pt-4 mt-4">
              <span><strong>Effective Date:</strong> November 26, 2026</span>
              <span><strong>Last Updated:</strong> November 26, 2026</span>
              <span><strong>Status:</strong> Active & Binding</span>
            </div>
          </div>

          {/* Document Body */}
          <div className="p-8 sm:p-12 space-y-8 text-slate-700 leading-relaxed text-sm sm:text-base">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                1. Introduction and Scope
              </h2>
              <p>
                Welcome to My Digit Asset (the "Service", "Platform", or "Web App"). We respect your privacy and are committed to protecting the personal information you share with us when accessing or using our website at <a href="https://www.mydigitasset.com" className="text-indigo-600 hover:underline">https://www.mydigitasset.com</a> and any related services, APIs, or tools.
              </p>
              <p>
                This Privacy Policy explains what information we collect, how we use and safeguard it, with whom we may share it, and what rights and choices you have regarding your personal data. By creating an account, accessing, or using the Service, you acknowledge that you have read and understood this Privacy Policy.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                2. Information We Collect
              </h2>
              <p>
                Depending on how you interact with our Web App, we may collect the following categories of information:
              </p>

              <div className="space-y-3 pl-4 border-l-2 border-indigo-200">
                <h3 className="font-semibold text-slate-900">2.1 Information You Provide Directly</h3>
                <ul className="list-disc pl-5 space-y-2 text-slate-600">
                  <li><strong>Account & Profile Information:</strong> Name, email address, username, password (stored in hashed/encrypted form), phone number, profile photo, and organization or company details.</li>
                  <li><strong>Billing & Transaction Data:</strong> Billing address, tax identification numbers (such as GSTIN or VAT ID), subscription plan details, and transaction references. Payment card or bank credentials are processed directly by our PCI-DSS compliant payment processors (e.g., Stripe, Razorpay, UPI, RTGS, NEFT, IMPS, Debit Card, or Credit Card) and are not stored on our servers.</li>
                  <li><strong>User Content & Inputs:</strong> Files, documents, text, prompts, messages, configurations, or other data you upload, generate, or input while using the Web App.</li>
                  <li><strong>Communications & Support:</strong> Records of correspondence when you contact our customer support team, submit feedback, or participate in surveys.</li>
                </ul>

                <h3 className="font-semibold text-slate-900 pt-2">2.2 Information Collected Automatically</h3>
                <ul className="list-disc pl-5 space-y-2 text-slate-600">
                  <li><strong>Device & Connection Data:</strong> IP address, browser type and version, operating system, device identifiers, screen resolution, and language preferences.</li>
                  <li><strong>Usage & Telemetry Logs:</strong> Pages or features accessed, timestamps, session duration, clickstream actions, referring URLs, and error or crash diagnostics.</li>
                  <li><strong>Cookies & Similar Technologies:</strong> Session tokens, authentication cookies, preference storage, and analytics identifiers used to keep you logged in and understand platform performance.</li>
                </ul>

                <h3 className="font-semibold text-slate-900 pt-2">2.3 Information from Third-Party Integrations</h3>
                <p className="text-slate-600">
                  If you choose to sign in using a third-party authentication provider (such as Google, GitHub, or Microsoft) or connect third-party tools to your account, we may receive basic profile information (such as your name, email address, and authorized access tokens) in accordance with the permissions you grant on that service.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                3. How We Use Your Information
              </h2>
              <p>We process the information we collect for the following legitimate business and operational purposes:</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><strong>Service Delivery & Account Management:</strong> To create and authenticate your account, provide core Web App features, process subscriptions, and maintain service availability.</li>
                <li><strong>Product Improvement & Analytics:</strong> To monitor usage trends, diagnose technical issues, optimize user experience, and develop new features.</li>
                <li><strong>Customer Support & Communications:</strong> To respond to inquiries, send transactional notifications (such as invoices, password resets, and security alerts), and inform you of important service updates.</li>
                <li><strong>Security & Fraud Prevention:</strong> To detect, prevent, and investigate unauthorized access, abuse, spam, security incidents, or violations of our Terms of Service.</li>
                <li><strong>Legal & Regulatory Compliance:</strong> To comply with applicable laws, tax obligations, lawful government requests, and to enforce our legal agreements.</li>
                <li><strong>Marketing (With Consent / Opt-Out):</strong> To send product newsletters, feature announcements, or promotional offers, where permitted by law. You may opt out at any time via the unsubscribe link in any marketing email.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                4. Legal Bases for Processing (GDPR / International Users)
              </h2>
              <p>
                Where required by applicable data protection laws (such as the EU/UK General Data Protection Regulation or India's Digital Personal Data Protection Act), we rely on the following legal bases to process your personal data:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><strong>Performance of a Contract:</strong> Processing necessary to provide the Web App and fulfill our obligations under our Terms of Service.</li>
                <li><strong>Consent:</strong> Where you have given clear, affirmative consent for specific purposes (e.g., optional marketing emails or non-essential cookies).</li>
                <li><strong>Legitimate Interests:</strong> Processing necessary for platform security, fraud prevention, internal analytics, and service improvement, provided such interests do not override your fundamental rights.</li>
                <li><strong>Legal Obligation:</strong> Processing required to comply with statutory, accounting, tax, or regulatory mandates.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                5. How We Share and Disclose Information
              </h2>
              <p>
                We do not sell, rent, or trade your personal information to third parties. We may share your information only in the following limited circumstances:
              </p>

              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-slate-200 text-left text-xs sm:text-sm">
                  <thead className="bg-slate-100 text-slate-800 font-semibold">
                    <tr>
                      <th className="p-3 border-b border-slate-200">Recipient Category</th>
                      <th className="p-3 border-b border-slate-200">Purpose of Disclosure</th>
                      <th className="p-3 border-b border-slate-200">Example Providers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-600">
                    <tr>
                      <td className="p-3 font-medium text-slate-900">Cloud Hosting & Infrastructure</td>
                      <td className="p-3">Hosting application servers, databases, and content delivery.</td>
                      <td className="p-3">AWS, Cloudflare, Google Cloud</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-900">Payment Processors</td>
                      <td className="p-3">Securely processing subscription payments and invoicing.</td>
                      <td className="p-3">Stripe, Razorpay, PayPal</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-900">Analytics & Monitoring</td>
                      <td className="p-3">Measuring application performance, uptime, and error tracking.</td>
                      <td className="p-3">Google Analytics, Sentry, PostHog</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-900">Communication & Email Tools</td>
                      <td className="p-3">Delivering transactional emails, alerts, and support tickets.</td>
                      <td className="p-3">Resend, SendGrid, Intercom</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><strong>Legal Compliance & Protection:</strong> We may disclose information if required by law, court order, or government regulation, or when necessary to protect the rights, safety, and property of our company, users, or the public.</li>
                <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, financing, or sale of company assets, user information may be transferred as part of the transaction, subject to standard confidentiality protections.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                6. Cookies and Tracking Technologies
              </h2>
              <p>We use cookies, local storage, and similar tracking technologies to operate and improve the Web App:</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><strong>Strictly Necessary Cookies:</strong> Required for user authentication, session security, and core site functionality. The Web App cannot function properly without these.</li>
                <li><strong>Preference & Functional Cookies:</strong> Remember your settings, theme, language, and interface preferences.</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how users interact with features so we can improve reliability and usability.</li>
              </ul>
              <p className="text-slate-600">
                You can manage or disable cookies through your browser settings or via our cookie consent banner (where applicable). Note that disabling essential cookies may affect your ability to log in or use certain features.
              </p>
            </section>

            {/* Section 7 */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                7. Data Retention and Security
              </h2>
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900">7.1 Data Retention</h3>
                <p className="text-slate-600">
                  We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, maintain your active account, or comply with legal, tax, and regulatory obligations. When you delete your account or request erasure, we will delete or anonymize your personal data within 60 days, except where retention is legally required.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <h3 className="font-semibold text-slate-900">7.2 Security Measures</h3>
                <p className="text-slate-600">
                  We implement industry-standard technical and organizational safeguards to protect your data against unauthorized access, alteration, disclosure, or destruction. These measures include encryption in transit (HTTPS/TLS), encryption at rest, role-based access controls, and regular security monitoring. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                8. International Data Transfers
              </h2>
              <p className="text-slate-600">
                Your information may be processed and stored on servers located in India, the United States, or the European Union or other jurisdictions where our cloud infrastructure and service providers operate. Where personal data is transferred across borders, we ensure appropriate safeguards are in place (such as Standard Contractual Clauses or equivalent legal mechanisms) to protect your information in accordance with applicable privacy laws.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                9. Your Privacy Rights and Choices
              </h2>
              <p>Depending on your jurisdiction, you may have the following rights regarding your personal information:</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><strong>Access & Portability:</strong> Request a copy of the personal data we hold about you in a structured, commonly used format.</li>
                <li><strong>Correction / Rectification:</strong> Update or correct inaccurate or incomplete account information directly in your account settings or by contacting us.</li>
                <li><strong>Deletion / Erasure:</strong> Request deletion of your account and personal data, subject to lawful retention exceptions.</li>
                <li><strong>Withdraw Consent & Opt-Out:</strong> Withdraw consent at any time where processing is based on consent, or opt out of marketing communications.</li>
                <li><strong>Restriction & Objection:</strong> Object to or request restriction of certain processing activities where permitted under local law.</li>
              </ul>
              <p className="text-slate-600 pt-2">
                To exercise any of these rights, please contact us at <a href="mailto:tmkrealty@gmail.com" className="text-indigo-600 font-medium hover:underline">tmkrealty@gmail.com</a>. We may verify your identity before fulfilling your request and will respond within the timeframe required by applicable law (typically within 30 days).
              </p>
            </section>

            {/* Section 10 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                10. Children's Privacy
              </h2>
              <p className="text-slate-600">
                Our Web App is not intended for individuals under the age of 13 ("Children"). We do not knowingly collect personal information from children without verifiable parental or guardian consent. If you believe a child has provided us with personal information, please contact us immediately at <a href="mailto:tmkrealty@gmail.com" className="text-indigo-600 font-medium hover:underline">tmkrealty@gmail.com</a>, and we will take steps to delete such information promptly.
              </p>
            </section>

            {/* Section 11 */}
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
                11. Changes to This Privacy Policy
              </h2>
              <p className="text-slate-600">
                We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, or legal requirements. When we make material changes, we will update the "Last Updated" date at the top of this document and notify you via email or an in-app notice prior to the changes taking effect. Your continued use of the Service after the effective date constitutes acceptance of the updated Privacy Policy.
              </p>
            </section>

            {/* Section 12 */}
            <section className="space-y-3 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
              <h2 className="text-xl font-bold text-slate-900 border-b border-indigo-200 pb-2">
                12. Contact Us & Grievance Officer
              </h2>
              <p className="text-slate-600">
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data protection practices, please contact us:
              </p>
              <div className="space-y-2 pt-2 text-slate-800">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-600" />
                  <span>Email: <a href="mailto:tmkrealty@gmail.com" className="font-semibold text-indigo-600 hover:underline">tmkrealty@gmail.com</a></span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>Website: <a href="https://www.mydigitasset.com" target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:underline">https://www.mydigitasset.com</a></span>
                </div>
              </div>
            </section>
          </div>

          {/* Footer Action */}
          <div className="bg-slate-50 p-6 sm:p-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Confidential & Proprietary | My Digit Asset (mydigitasset.com)
            </div>
            <div>
              <button
                onClick={onNavigateHome}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
