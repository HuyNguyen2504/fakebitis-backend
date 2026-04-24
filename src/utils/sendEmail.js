const nodemailer = require('nodemailer');

const sendConfirmationEmail = async (to, order) => {
  try {
    // Generate test SMTP service account from ethereal.email
    let testAccount = await nodemailer.createTestAccount();

    let transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, 
      auth: {
        user: testAccount.user, 
        pass: testAccount.pass, 
      },
    });

    const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

    let itemsHtml = order.items.map(item => `
      <li>
        <strong>${item.name}</strong> - Color: <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${item.color}; border:1px solid #ccc;"></span> ${item.color} - Size: ${item.size} - Qty: ${item.quantity} - Price: ${formatCurrency(item.price)}
      </li>
    `).join('');

    let info = await transporter.sendMail({
      from: '"Bitis Style Store" <noreply@bitis.example.com>',
      to: to,
      subject: "Order Confirmation - Bitis Style",
      html: `
        <h2>Thank you for your purchase!</h2>
        <p>Your order <strong>#${order._id}</strong> has been paid successfully via VNPAY.</p>
        <h3>Order Details:</h3>
        <ul>${itemsHtml}</ul>
        <h3>Total: ${formatCurrency(order.totalAmount)}</h3>
        <p>We will notify you when it ships.</p>
      `,
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error("Email error: ", error);
  }
};

module.exports = sendConfirmationEmail;
