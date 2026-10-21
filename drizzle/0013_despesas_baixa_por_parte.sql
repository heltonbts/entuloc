ALTER TABLE "despesas" RENAME COLUMN "paga_em" TO "vencimento_em";--> statement-breakpoint
ALTER TABLE "despesas" ADD COLUMN "parte_1_paga_em" date;--> statement-breakpoint
ALTER TABLE "despesas" ADD COLUMN "parte_2_paga_em" date;--> statement-breakpoint
ALTER TABLE "despesas" ADD COLUMN "parte_3_paga_em" date;
