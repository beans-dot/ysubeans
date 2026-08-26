import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../backend/src/app.module';
import { StrategicPlanService } from '../backend/src/modules/strategic-plan/strategic-plan.service';

dotenv.config();

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const svc = app.get(StrategicPlanService);

    const tree = await svc.getTree();
    console.log('goals', tree.goals.length);
    console.log('tasks', tree.tasks.length);
    console.log('kpis', tree.kpis.length);
    console.log('years', tree.years);
    console.log('vision.mission', tree.vision?.mission);
    console.log('vision.mottoPairs', JSON.stringify(tree.vision?.mottoPairs));
    console.log(
      'sample task',
      JSON.stringify(tree.goals[0].strategies[0].tasks[0]),
    );
    console.log('sample kpi', JSON.stringify(tree.kpis[0]));
    console.log(
      'tasks with no kpi',
      tree.tasks.filter((t) => t.kpiCodes.length === 0).length,
    );

    const cmp = await svc.getCompare();
    console.log('compare years', cmp.years, 'indicators', cmp.indicators.length);
    console.log('fac alt', JSON.stringify(cmp.indicators.find((i) => i.id === 'fac')?.alt));

    const funds = await svc.listFundSources();
    console.log('funds', funds.map((f) => `${f.fundSourceId}:${f.fundSourceName}`).join(', '));

    const taskCode = tree.tasks[0].taskCode;
    const subtaskCode =
      tree.tasks[0].subtasks[0]?.subtaskCode ?? taskCode;
    await svc.upsertEvaluation(
      { taskCode, year: 2026, deptSummary: '스모크 테스트', deptGrade: '보통' },
      'smoke',
    );
    console.log('evals 2026', (await svc.listEvaluations(2026)).length);

    await svc.upsertBudget(
      {
        taskCode,
        subtaskCode,
        year: 2026,
        fundSourceId: funds[0].fundSourceId,
        budgetAmount: 1234000,
      },
      'smoke',
    );
    const budgets = await svc.listBudgets(2026);
    console.log('budgets 2026', JSON.stringify(budgets));

    await svc.upsertBudget(
      {
        taskCode,
        subtaskCode,
        year: 2026,
        fundSourceId: funds[0].fundSourceId,
        budgetAmount: null,
        settlementAmount: null,
      },
      'smoke',
    );
    console.log('budgets after clear', (await svc.listBudgets(2026)).length);

    await svc.setKpiResult(tree.kpis[0].kpiCode, 2026, 81.5, 'smoke');
    const tree2 = await svc.getTree();
    console.log('kpi result', JSON.stringify(tree2.kpis[0].results));
    await svc.setKpiResult(tree.kpis[0].kpiCode, 2026, null, 'smoke');

    // cleanup smoke evaluation
    console.log('done');
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
