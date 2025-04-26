import { NextApiRequest, NextApiResponse } from "next";

import { checkRequestType, createOrder, generateResponse, getUser } from "../../utils";
import prisma from "../../utils/prisma";
import { Address, RequestType } from "../../utils/types";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  checkRequestType("POST", req.method as RequestType, res);

  try {
    const cartItems = req.body?.cart || {}; // { quantity: 3 }
    const user = await getUser(req);

    if (!user) {
      return generateResponse("401", "Please login to continue.", res);
    }

    const productIds = Object.keys(cartItems);

    if (!productIds.length) {
      return generateResponse("200", "Cart is empty.", res);
    }

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        price: true,
        title: true,
      },
    });

    const cartTotal = products.reduce(
      (prevValue, product) => prevValue + product.price * cartItems[product.id].quantity,
      0
    );

    const defaultAddress = user.addresses.find((address) => (address as Address).default);

    // Create Razorpay order
    const razorpayOrder = await createOrder(cartTotal);

    return generateResponse("200", "Purchase successful.", res, {
      data: {
        orderId: razorpayOrder.id,
        razorpayKeyId:"rzp_test_IotSFe4lpOlWIH",
        cartTotal,
      },
    });
  } catch (error) {
    console.error("Checkout Error:", error);
    return generateResponse("400", "Something went wrong.", res);
  }
};
