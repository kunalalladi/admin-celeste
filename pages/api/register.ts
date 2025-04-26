import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma, User } from "@prisma/client";

import prisma from "../../utils/prisma";
import { PartialBy, RequestType } from "../../utils/types";
import { checkRequestType, generateJWT, generateResponse, hashPhassword } from "../../utils";
import { validateUserCred } from "../../utils/validation";

// Define the expected input type matching the schema
type CreateUserInput = {
  email: string;
  password: string;
  fullname?: string | null;
  profile?: string | null;
  profileImageId?: string | null;
  bio?: string | null;
  joining_reasons: string[];
  stripe_customer_id: string;
  addresses: Record<string, any>[]; // Using Record for Json array
  isAdmin?: boolean;
  interestIds?: string[];
  favouriteProductIds?: string[];
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  checkRequestType("POST", req.method as RequestType, res);

  try {
    const body = (req.body || {}) as CreateUserInput;
    console.log("📌 Incoming Request Body:", body);
    const validationResponse = await validateUserCred(body, true);

    if (validationResponse) {
      const message = validationResponse?.errorMessage?.message || "Invalid input provided.";
      return generateResponse("400", message, res, validationResponse);
    }

    const userData: Prisma.UserCreateInput = {
      email: body.email,
      password: await hashPhassword(body.password),
      fullname: body.fullname || null,
      profile: body.profile || null,
      profileImageId: body.profileImageId || null,
      bio: body.bio || null,
      joining_reasons: body.joining_reasons,
      stripe_customer_id: "cus_12345",
      addresses: body.addresses,
      isAdmin: body.isAdmin || false,
      interests: body.interestIds ? {
        connect: body.interestIds.map(id => ({ id }))
      } : undefined,
      favouriteProducts: body.favouriteProductIds ? {
        connect: body.favouriteProductIds.map(id => ({ id }))
      } : undefined
    };

    const user: PartialBy<User, "password"> = await prisma.user.create({
      data: userData,
    });

    const token = await generateJWT(user.id);

    delete user.password;

    return generateResponse("200", "Your account is successfully created.", res, {
      token,
      data: {
        ...user,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return generateResponse("400", "Something went wrong.", res);
  }
};