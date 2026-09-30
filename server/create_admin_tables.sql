-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'user',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `metadata` LONGTEXT NULL,
    `riskScore` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `eStamp` VARCHAR(191) NULL,
    `apCode` VARCHAR(191) NULL,
    `boid` VARCHAR(191) NULL,

    UNIQUE INDEX `User_phone_key`(`phone`),
    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_eStamp_key`(`eStamp`),
    UNIQUE INDEX `User_boid_key`(`boid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KycApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `personalDetails` LONGTEXT NULL,
    `identityMethod` VARCHAR(191) NULL,
    `identityDetails` LONGTEXT NULL,
    `ocrData` LONGTEXT NULL,
    `faceMatchScore` DOUBLE NULL,
    `address` LONGTEXT NULL,
    `bankDetails` LONGTEXT NULL,
    `nomineeDetails` LONGTEXT NULL,
    `nomineeAllocation` LONGTEXT NULL,
    `panUpload` LONGTEXT NULL,
    `signature` LONGTEXT NULL,
    `financialProof` LONGTEXT NULL,
    `selfieDetails` LONGTEXT NULL,
    `documents` LONGTEXT NULL,
    `selfie` VARCHAR(191) NULL,
    `consent` BOOLEAN NOT NULL DEFAULT false,
    `rejectionReason` VARCHAR(191) NULL,
    `nsdlRequest` LONGTEXT NULL,
    `nsdlResponse` LONGTEXT NULL,
    `segments` LONGTEXT NULL,
    `bsda` VARCHAR(191) NULL,
    `declarations` LONGTEXT NULL,
    `generatedPdfBase64` LONGTEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `assignedTo` INTEGER NULL,
    `deviceType` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `riskCategory` VARCHAR(191) NOT NULL DEFAULT 'low',
    `riskScore` INTEGER NOT NULL DEFAULT 0,
    `source` VARCHAR(191) NOT NULL DEFAULT 'organic',
    `assignedCrmAgentId` INTEGER NULL,
    `stepStatuses` LONGTEXT NULL,
    `isResubmitted` BOOLEAN NOT NULL DEFAULT false,
    `globeRemarks` LONGTEXT NULL,
    `globeReviewedAt` DATETIME(3) NULL,
    `globeReviewedBy` INTEGER NULL,
    `globeStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `pushedToBackoffice` BOOLEAN NOT NULL DEFAULT false,
    `pushedToBackofficeAt` DATETIME(3) NULL,
    `clientCode` VARCHAR(191) NULL,
    `esignDetails` LONGTEXT NULL,
    `correctionDraft` LONGTEXT NULL,

    UNIQUE INDEX `KycApplication_applicationId_key`(`applicationId`),
    INDEX `KycApplication_assignedTo_fkey`(`assignedTo`),
    INDEX `KycApplication_reviewedBy_fkey`(`reviewedBy`),
    INDEX `KycApplication_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `details` LONGTEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `adminId` INTEGER NULL,
    `newValue` LONGTEXT NULL,
    `oldValue` LONGTEXT NULL,
    `targetId` VARCHAR(191) NULL,
    `targetType` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `crmAgentId` INTEGER NULL,
    `crmAgentName` VARCHAR(191) NULL,

    INDEX `AuditLog_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `requestBody` LONGTEXT NULL,
    `responseBody` LONGTEXT NULL,
    `statusCode` INTEGER NOT NULL,
    `latency` INTEGER NOT NULL,
    `applicationId` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `error` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `permissions` LONGTEXT NOT NULL,
    `color` VARCHAR(191) NULL DEFAULT '#7c3aed',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sequence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Sequence_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EStamp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `certificateNo` VARCHAR(191) NOT NULL DEFAULT '',
    `serialNo` VARCHAR(191) NOT NULL DEFAULT '',
    `fileUrl` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'available',
    `assignedTo` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EStamp_assignedTo_key`(`assignedTo`),
    INDEX `EStamp_certificateNo_idx`(`certificateNo`),
    INDEX `EStamp_serialNo_idx`(`serialNo`),
    INDEX `EStamp_assignedTo_fkey`(`assignedTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PdfTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `basePdfUrl` VARCHAR(191) NOT NULL DEFAULT 'public/esigned.pdf',
    `fields` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PdfTemplate_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Boid` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `boidNumber` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'available',
    `assignedTo` INTEGER NULL,
    `coolingPeriodEnds` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Boid_boidNumber_key`(`boidNumber`),
    UNIQUE INDEX `Boid_assignedTo_key`(`assignedTo`),
    INDEX `Boid_boidNumber_idx`(`boidNumber`),
    INDEX `Boid_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KycApplication` ADD CONSTRAINT `KycApplication_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KycApplication` ADD CONSTRAINT `KycApplication_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KycApplication` ADD CONSTRAINT `KycApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EStamp` ADD CONSTRAINT `EStamp_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Boid` ADD CONSTRAINT `Boid_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

