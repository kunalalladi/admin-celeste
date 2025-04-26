import { NextApiRequest, NextApiResponse } from "next";
import { v4 } from "uuid";

import { checkRequestType, fetchPaymentInfo, generateResponse, getUser } from "../../utils";
import prisma from "../../utils/prisma";
import { RequestType } from "../../utils/types";

export default async function handlePayment(req: NextApiRequest, res: NextApiResponse) {
  checkRequestType("POST", req.method as RequestType, res);

  try {
    const user = await getUser(req);

    if (!user) {
      return generateResponse("401", "Please login to continue.", res);
    }

    const paymentInfo = await fetchPaymentInfo(req.body.transactionId);

    if (!paymentInfo?.id) {
      throw new Error("Transaction not found.");
    }

    // Extract product IDs from details
    const productIds = Object.keys(req.body.details);

    type PaymentStatus = "PENDING" | "FAILED" | "SUCCESS";

    // Create transaction record matching your schema
    const transactionDetail = await prisma.transactions.create({
      data: {
        details: req.body.details,
        userId: user.id,
        orderId: `rp-${v4().replace("-", "").substring(2, 14)}`,
        transactionId: req.body.transactionId,
        address: req.body.address,
        amount: paymentInfo.amount,
        status: paymentInfo.status as PaymentStatus,
        orderStatus: "INPROCESS",
        productIds: productIds,
      },
    });

    // Update product quantities
    const updatePromises = productIds.map(async (productId) => {
      const { quantity } = req.body.details[productId];
      return prisma.product.update({
        where: { id: productId },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });
    });

    await Promise.all(updatePromises);

    return generateResponse("200", "Purchase successful.", res, {
      data: transactionDetail,
    });
  } catch (error) {
    console.error("Payment processing error:", error);
    return generateResponse("400", "Something went wrong processing the payment.", res);
  }
}

