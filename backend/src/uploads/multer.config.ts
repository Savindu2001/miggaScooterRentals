import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

const ACCEPTED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 500 * 1024; // 500 KB

function imageFileFilter(
  _req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  const ext = extname(file.originalname).toLowerCase();
  if (!ACCEPTED_IMAGE_TYPES.includes(ext)) {
    return callback(
      new BadRequestException(
        `Only ${ACCEPTED_IMAGE_TYPES.join(', ')} files are accepted`,
      ),
      false,
    );
  }
  callback(null, true);
}

export const passportImageStorage = {
  storage: diskStorage({
    destination: './uploads/passports',
    filename: (_req, file, cb) => {
      const uniqueName = `${uuidv4()}${extname(file.originalname).toLowerCase()}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
};

export const scooterImageStorage = {
  storage: diskStorage({
    destination: './uploads/scooters',
    filename: (_req, file, cb) => {
      const uniqueName = `${uuidv4()}${extname(file.originalname).toLowerCase()}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
};

export const signatureImageStorage = {
  storage: diskStorage({
    destination: './uploads/signatures',
    filename: (_req, file, cb) => {
      const uniqueName = `${uuidv4()}${extname(file.originalname).toLowerCase()}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
};

export const agreementPdfStorage = {
  storage: diskStorage({
    destination: './uploads/agreements',
    filename: (_req, file, cb) => {
      const uniqueName = `${uuidv4()}.pdf`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (file.mimetype !== 'application/pdf') {
      return callback(new BadRequestException('Only PDF files are accepted'), false);
    }
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB for PDFs
};
