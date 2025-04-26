import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../utils/prisma";


import { checkRequestType, fetchPaymentInfo, generateResponse, getUser } from "../../utils";
import { RequestType } from "../../utils/types";

import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

export async function getPaymentMethods(req: NextApiRequest, res: NextApiResponse) {
  checkRequestType("GET", req.method as RequestType, res);

  try {
    const user = await getUser(req);

    if (!user) {
      return generateResponse("401", "Please login to continue.", res);
    }

    const transactions = await prisma.transactions.findMany({
      where: { 
        userId: user.id,
        status: 'SUCCESS'
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch Razorpay payment details for successful transactions
    const paymentMethods = new Set();
    const paymentDetails = [];

    for (const transaction of transactions) {
      try {
        const payment = await razorpay.payments.fetch(transaction.transactionId);
        
        if (payment.card && payment.card.last4) {
          const cardKey = `${payment.card.network}-${payment.card.last4}`;
          
          if (!paymentMethods.has(cardKey)) {
            paymentMethods.add(cardKey);
            paymentDetails.push({
              brand: payment.card.network || "Unknown",
              expiry: `${payment.card.expiry_month}/${payment.card.expiry_year}`,
              last4: payment.card.last4,
              type: payment.card.type,
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching payment ${transaction.transactionId}:`, error);
      }
    }

    return generateResponse("200", "Payment methods fetched successfully.", res, {
      data: paymentDetails,
    });
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return generateResponse("400", "Something went wrong fetching payment methods.", res);
  }
}
