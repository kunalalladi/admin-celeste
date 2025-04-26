import { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import jwt, { Secret } from "jsonwebtoken";
import { User } from "@prisma/client";
import Razorpay from "razorpay";
import { Prisma } from '@prisma/client'
import cookie from "cookie";

import { Address, AsyncFnType, RequestType, Status } from "./types";
import { PRISMA_ERRORS } from "./enum";
import prisma from "./prisma";



// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: "rzp_test_IotSFe4lpOlWIH",
  key_secret: "Mmw2dTa3hCKzbSYNBwJ8YSpr",
});

export const generateResponse = (status: Status, message: string, res: NextApiResponse, extraInfo?: object) =>
  res.status(parseInt(status)).json({
    message,
    status,
    ...extraInfo,
  });

export const checkRequestType = (endPointRequestTYpe: RequestType, userRequestType: RequestType, res: NextApiResponse) => {
  if (userRequestType !== endPointRequestTYpe) {
    return generateResponse("405", `Request type ${userRequestType} is not allowed`, res);
  }
};

export const decodeJWT = async (authHeader = "") => {
  const [, token] = authHeader.split("Bearer ");
  const decoded = await jwt.verify(token, process.env.JWT_SECRET as Secret);
  return decoded;
};

export const hashPhassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

export const generateJWT = async (userId: string) => {
  const token = await jwt.sign(
    { id: userId },
    process.env.JWT_SECRET as Secret,
  );
  return token;
};

export const comparePassword = (password: string, currentPassword: string) => 
  bcrypt.compareSync(password, currentPassword);

export const catchAsyncError = (fn: AsyncFnType) => (req: NextApiRequest, res: NextApiResponse) =>
  fn(req, res).catch((error) => {
    let status: Status = "500";
    let message = error?.message || "Server Error.";

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      [PRISMA_ERRORS.INCONSITENT, PRISMA_ERRORS.NOT_FOUND].includes(error.code as PRISMA_ERRORS)
    ) {
      message = "Record not found.";
      status = "404";
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      message = "Please check field types.";
      status = "400";
    }

    if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) {
      status = "500";
    }

    return generateResponse(status, status === "500" ? "Server Error" : message || "Something went wrong.", res);
  });

export const isInvalidObject = (keys: string[], object: Object) => 
  Object.keys(object).some((key) => !keys.includes(key));

export const isValidJSONString = (value: string) => {
  try {
    JSON.parse(value);
  } catch (error) {
    return false;
  }
  return true;
};

export const getUser = async (request: NextApiRequest) => {
  try {
    let token = request?.headers?.token as string;
    if (!token && request.headers.cookie) {
      token = `Bearer ${cookie.parse(request.headers.cookie).token}`;
    }

    const decoded = (await decodeJWT(request?.headers?.authorization || token)) as User;

    const user = await prisma.user.findFirst({
      where: { id: decoded.id },
      include: {
        interests: {
          select: {
            id: true,
            name: true,
            parentId: true,
          },
        },
      },
    });

    return user;
  } catch (error) {
    return null;
  }
};

// Razorpay specific functions
export const createOrder = async (amount: number, currency: string = "INR") => {
  try {
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency,
      payment_capture: true,
    });
    return order;
  } catch (error) {
    console.error("Razorpay Order Error:", error); // Log actual error
    throw new Error("Error creating Razorpay order");
  }
};


export const verifyPayment = (
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string
) => {
  try {
    const generated_signature = require('crypto')
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    
    return generated_signature === razorpay_signature;
  } catch (error) {
    throw new Error("Error verifying Razorpay payment");
  }
};

type PaymentStatus = "PENDING" | "FAILED" | "SUCCESS";
type OrderStatus = "INPROCESS" | "DELIVERED" | "CANCELLED";

interface TransactionCreateInput {
  details: any[];
  userId: string;
  orderId: string;
  transactionId: string;
  address: any;
  amount: number;
  status: PaymentStatus;
  orderStatus: OrderStatus;
  productIds: string[];
}



export const fetchPaymentInfo = async (paymentId: string) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      id: payment.id,
      amount: (typeof payment.amount === "string" ? parseFloat(payment.amount) : payment.amount) / 100, // Ensure it's a number
      status: payment.status === 'captured' ? 'SUCCESS' : 
              payment.status === 'failed' ? 'FAILED' : 'PENDING',
      details: payment
    };
  } catch (error) {
    console.error("Error fetching Razorpay payment:", error);
    throw new Error("Error fetching payment information");
  }
};

export const fetchUserPayments = async (userId: string) => {
  try {
    const transactions = await prisma.transactions.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const paymentPromises = transactions.map(async (transaction) => {
      try {
        const paymentInfo = await razorpay.payments.fetch(transaction.transactionId);
        return {
          ...transaction,
          paymentDetails: paymentInfo
        };
      } catch (error) {
        console.error(`Error fetching payment ${transaction.transactionId}:`, error);
        return transaction;
      }
    });

    return Promise.all(paymentPromises);
  } catch (error) {
    console.error("Error fetching user payments:", error);
    throw new Error("Error fetching payment methods");
  }
};

export const refundPayment = async (paymentId: string, amount?: number) => {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount ? amount * 100 : undefined, // Optional amount for partial refunds
    });
    return refund;
  } catch (error) {
    throw new Error("Error processing refund");
  }
};

export const wait = (delay: number): Promise<void> => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
};