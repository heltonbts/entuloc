ALTER TABLE "despesas" DROP CONSTRAINT "despesas_partes_somam_valor";--> statement-breakpoint
ALTER TABLE "despesas" ADD COLUMN "parte_4" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "despesas" ADD COLUMN "parte_4_paga_em" date;--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_partes_somam_valor" CHECK ("despesas"."parte_1" >= 0 AND "despesas"."parte_2" >= 0 AND "despesas"."parte_3" >= 0 AND "despesas"."parte_4" >= 0
       AND "despesas"."parte_1" + "despesas"."parte_2" + "despesas"."parte_3" + "despesas"."parte_4" = "despesas"."valor");