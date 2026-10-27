-- CreateTable
CREATE TABLE `autenticacion_tokens_recuperacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `fecha_expiracion` DATETIME(3) NOT NULL,
    `fecha_uso` DATETIME(3) NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `autenticacion_tokens_recuperacion_token_hash_key`(`token_hash`),
    INDEX `autenticacion_tokens_recuperacion_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `autenticacion_tokens_recuperacion` ADD CONSTRAINT `autenticacion_tokens_recuperacion_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `autenticacion_usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
