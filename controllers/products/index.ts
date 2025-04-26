import { Category, Prisma, Product } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";

import prisma from "../../utils/prisma";
import { FileType } from "../../utils/types";
import { delete_image_from_imagekit, upload_on_imagekit } from "../../utils/upload";
import { validateProduct } from "../../utils/validation";
import { generateResponse, getUser } from "../../utils";
// import { extractImageFeatures } from "../../utils/featureExtractor";

type CategoryInfo = Pick<Category, "id" | "name">[];
type ProductInfo = Partial<Product> & { categories?: CategoryInfo };

const getRequestHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  const take = req.query.take !== undefined ? parseInt(req.query?.take as string) : 10;
  const skip = req.query.skip !== undefined ? parseInt(req.query?.skip as string) : 0;

  const options: Prisma.ProductFindManyArgs = {};

  // 🔍 product based on title and description
  if (req.query?.search) {
    const searchText = req.query.search as string;
    options.where = {
      OR: [
        {
          title: {
            contains: searchText,
            mode: "insensitive",
          },
        },
      ],
    };
  }

  // 👀 for products with category
  if (req?.query?.category) {
    const categories = typeof req.query.category === "string" ? [req.query.category] : req?.query?.category;

    options.where = {
      categoryIds: {
        hasSome: categories,
      },
    };
  }

  if (req?.query?.categoryId) {
    const categoryId = req.query.categoryId as string;
    
    // Get all subcategories that have this as parent (direct children)
    const subcategories = await prisma.category.findMany({
      where: { 
        parentId: categoryId 
      },
      select: { 
        id: true 
      }
    });
    
    // Create array with parent + all subcategory IDs
    const allRelatedCategoryIds = [
      categoryId,
      ...subcategories.map(sub => sub.id)
    ];
    
    // Use array_overlaps logic to find products that have ANY of these categories
    options.where = {
      ...options.where,
      OR: [
        {
          categoryIds: {
            hasSome: allRelatedCategoryIds
          }
        }
      ]
    };
  }

  if (req?.query?.categoryIds) {
    const categoryIds = (req.query.categoryIds as string).split(',');
    
    options.where = {
      ...options.where,
      categoryIds: {
        hasSome: categoryIds,
      },
    };
  }


  // 👀 for featured products
  if (req?.query?.isFeatured === "true") {
    options.where = {
      ...options.where,
      isFeatured: true,
    };
  }

  // 👀 for products with hot deals
  if (req.query?.isHotDeals === "true") {
    options.where = {
      ...options.where,
      discount: {
        gt: 0,
      },
    };

    options.orderBy = {
      discount: "desc",
    };
  }

  // 👀 for selection fields
  // expecting to be a string with comma seperated values
  if (req?.query?.select) {
    const selectedFields = typeof req?.query?.select === "string" ? [req.query.select] : req.query.select;

    const selection = selectedFields.reduce(
      (previousValues, currentValue) => ({ ...previousValues, ...{ [currentValue]: true } }),
      {} as Prisma.ProductSelect,
    );

    if (Object.keys(selection).length) {
      // if category field in selection
      if (Object.keys(selection).includes("category")) {
        selection.category = {
          select: {
            id: true,
            name: true,
          },
        };
      }

      options.select = selection;
    }
  }

  const totalCountPromise = prisma.product.count({ where: options.where });
  const productsPromise = prisma.product.findMany({ skip, take, ...options });

  const [count, products]: [number, ProductInfo[]] = await Promise.all([totalCountPromise, productsPromise]);

  const prefix = req.headers.host?.includes("localhost") ? "http://" : "https://";
  const url = `${prefix}${req.headers.host}/api/products/`;
  const nextTake = skip + take;
  const next = nextTake >= count ? null : `${url}?take=${take}&skip=${nextTake}`;

  return generateResponse("200", "Products fetched..", res, { data: products, next, count });
};

const getIndividualProductHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  const productId = req.query?.id as string;

  const product = await prisma.product.findFirst({
    where: { id: productId },
    include: {
      category: {
        select: {
          name: true,
          id: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  return generateResponse("200", "Product info fetched.", res, { data: product });
};

const postRequestHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  const user = await getUser(req);

  if (!user?.isAdmin) {
    return generateResponse("403", "Unauthorized access.", res, { errorMessage: "You're not authorized.", redirect: true });
  }

  const files = req.files || [];
  // console.log("Received Files:", files); // Debugging

  const data = { ...req.body, images: files };

  const validationResponse = await validateProduct(data);
  if (validationResponse) {
    return generateResponse("400", "Invalid input provided.", res, validationResponse);
  }

  // → Parsing data correctly
  data.price = parseFloat(req.body.price) || 0;
  data.quantity = parseInt(req.body.quantity) || 0;
  data.discount = parseFloat(req.body.discount) || 0;

  // → Handling categories correctly
  try {
    const categories = JSON.parse(req.body.categories || "[]");
    data.categoryIds = categories;
  } catch (error) {
    return generateResponse("400", "Invalid categories format", res);
  }

   // → Parse array fields
   try {
    // Parse sizes array
    if (req.body.sizes) {
      data.sizes = JSON.parse(req.body.sizes);
    } else {
      data.sizes = [];
    }

    // Parse keyFeatures array
    if (req.body.keyFeatures) {
      data.keyFeatures = JSON.parse(req.body.keyFeatures);
    } else {
      data.keyFeatures = [];
    }

    // Parse specifications (JSON object array)
    if (req.body.specifications) {
      data.specifications = JSON.parse(req.body.specifications);
    } else {
      data.specifications = [];
    }

    // Care instructions is a string field - just assign it directly
    data.careInstructions = req.body.careInstructions || "";

  } catch (error) {
    console.error("Error parsing array fields:", error);
    return generateResponse("400", "Invalid format for array fields", res);
  }

  // → Parsing slideColors & variants safely
  if (req.body.slideColors) {
    try {
      data.slideColors = JSON.parse(req.body.slideColors);
    } catch (error) {
      return generateResponse("400", "Invalid slideColors format", res);
    }
  }

  if (req.body.variants) {
    try {
      data.variants = JSON.parse(req.body.variants);
    } catch (error) {
      return generateResponse("400", "Invalid variants format", res);
    }
  }

  delete data.categories; // Remove old category reference

  // → Uploading images to ImageKit safely
  let images = [];
  try {
    images = await Promise.all(files.map((image: FileType) => upload_on_imagekit(image.buffer, image.originalname)));
  } catch (error) {
    console.error("Image upload error:", error);
    return generateResponse("500", "Image upload failed", res);
  }

  // → Ensure required fields are present
  if (!data.title || !data.price || !data.quantity || !data.categoryIds?.length) {
    return generateResponse("400", "Missing required fields.", res);
  }

  // → Add product safely
  try {
    const product = await prisma.product.create({
      data: {
        ...data,
        images,
      },
    });

    //     // Generate embeddings for each image asynchronously
    // // We don't await this so it doesn't block the API response
    // Promise.all(
    //   images.map(async (image: any) => {
    //     try {
    //       // Use the image URL to generate embeddings
    //       await extractImageFeatures(image.url, product.id);
    //     } catch (embeddingError) {
    //       console.error(`Failed to generate embedding for image ${image.url}:`, embeddingError);
    //       // We don't fail the request if embedding generation fails
    //     }
    //   })
    // ).catch(error => {
    //   console.error("Error in embedding generation:", error);
    // });

    return generateResponse("200", "Product created successfully.", res, { data: product });
  } catch (error) {
    console.error("Database error:", error);
    return generateResponse("500", "Internal Server Error", res);
  }
};


const patchRequestHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  const user = await getUser(req);

  if (!user?.isAdmin) {
    return generateResponse("403", "Unauthorized access.", res, { errorMessage: "You're not authorized.", redirect: true });
  }

  const productId = req.query?.id as string;

  // → Fetch product details
  const productInfo = await prisma.product.findFirst({ where: { id: productId } });

  // ⚠️ Product not exist
  if (!productInfo) {
    throw new Error("Product not found.");
  }

  const files = req.files || [];

  const data = { ...req.body, images: files };
  const validationResponse = await validateProduct(data, productInfo);

  if (validationResponse) {
    return generateResponse("400", "Invalid input provided.", res, validationResponse);
  }

  // → If data is ✌️ parse the required values and if
  // → new images added by user upload them
  if (data.price) data.price = parseFloat(req.body.price);
  if (data.quantity) data.quantity = parseInt(req.body.quantity);
  if (data.slideColors) data.slideColors = JSON.parse(req.body.slideColors);
  if (data.discount) data.discount = parseFloat(req.body.discount) || 0;
   // Parse sizes array if present
   if (req.body.sizes) {
    data.sizes = JSON.parse(req.body.sizes);
  }
  
  // Parse keyFeatures array if present
  if (req.body.keyFeatures) {
    data.keyFeatures = JSON.parse(req.body.keyFeatures);
  }
  
  // Parse specifications JSON array if present
  if (req.body.specifications) {
    data.specifications = JSON.parse(req.body.specifications);
  }
  if (data.categories) {
    const categories = JSON.parse(req.body.categories);
    data.category = {
      disconnect: productInfo.categoryIds.map((id) => ({ id })),
      connect: categories.map((categpry: string) => ({ id: categpry })),
    };
    delete data.categories;
  }

  // Handle careInstructions (string field)
  if (req.body.careInstructions !== undefined) {
    data.careInstructions = req.body.careInstructions;
  }
  let newImages = [];
  if (data.images.length) {
    newImages = await Promise.all(files.map((image: FileType) => upload_on_imagekit(image.buffer, image.originalname)));
    data.images = [...productInfo.images, ...newImages];
  } else {
    delete data.images;
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data,
    include: {
      category: {
        select: {
          name: true,
          id: true,
        },
      },
    },
  });

  // // If there are new images, generate embeddings for them
  // if (newImages.length > 0) {
  //   // We don't await this so it doesn't block the API response
  //   Promise.all(
  //     newImages.map(async (image: any) => {
  //       try {
  //         await extractImageFeatures(image.url, productId);
  //       } catch (embeddingError) {
  //         console.error(`Failed to generate embedding for image ${image.url}:`, embeddingError);
  //       }
  //     })
  //   ).catch(error => {
  //     console.error("Error in embedding generation for updated product:", error);
  //   });
  // }

  return generateResponse("200", "Product created endpoint hit.", res, { data: product });
};

const deleteProductImageHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  const user = await getUser(req);

  if (!user?.isAdmin) {
    return generateResponse("403", "Unauthorized access.", res, { errorMessage: "You're not authorized.", redirect: true });
  }

  const imageId = req.query?.id;
  const productId = req.body?.productId;

  if (!productId) {
    throw new Error("Product id not provided.");
  }

  // ⚠️ productId not exist
  const productInfo = await prisma.product.findFirst({ where: { id: productId } });

  if (!productInfo) {
    throw new Error("Product id not found.");
  }

  const images = productInfo.images || [];

  if (productInfo.images.length === 1) {
    throw new Error("You're not allowed to delete only present image of product.");
  }

  // ⚠️ imageId not exist
  const imageIndex = images?.findIndex((product: any) => product?.fileId === imageId);

  if (imageIndex === -1) {
    throw new Error("Image id not found in product.");
  }

  // Get the image URL before removing it
  // const imageToDelete = images[imageIndex];
  // const imageUrl = imageToDelete.url;

  const slideColors = productInfo.slideColors || [];
  if (slideColors.length > 1) {
    slideColors.splice(imageIndex, 1);
  }

  // 🗑 image from imagekit and update product image field
  await delete_image_from_imagekit(imageId as string);
  images.splice(imageIndex, 1);

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      images,
      slideColors,
    },
    include: {
      category: {
        select: {
          name: true,
          id: true,
        },
      },
    },
  });

  // // Delete the corresponding embedding
  //   try {
  //     await prisma.imageEmbedding.deleteMany({
  //       where: {
  //         productId,
  //         imageUrl
  //       }
  //     });
  //     console.log(`✅ Deleted embedding for image: ${imageUrl}`);
  //   } catch (error) {
  //     console.error("Error deleting image embedding:", error);
  //     // Continue with the process even if embedding deletion fails
  //   }

  return generateResponse("200", "Product image removed.", res, { data: product });
};

export default {
  getRequestHandler,
  getIndividualProductHandler,
  postRequestHandler,
  patchRequestHandler,
  deleteProductImageHandler,
};
