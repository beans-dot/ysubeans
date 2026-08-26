  async createGoal(dto: UpsertGoalDto, userId: string) {
    return this.structure.createGoal(
      { alphaCode: dto.goalId, name: dto.goalName, year: dto.year },
      userId,
    );
  }

  async updateGoal(goalId: string, dto: UpdateGoalDto, userId: string) {
    return this.structure.updateNode(
      {
        kind: 'goal',
        lineageId: goalId,
        year: dto.year,
        patch: { goalName: dto.goalName },
      },
      userId,
    );
  }

  async deleteGoal(goalId: string, year: number, userId: string) {
    return this.structure.abolishNode(
      { kind: 'goal', lineageId: goalId, year },
      userId,
    );
  }

  async createStrategy(dto: UpsertStrategyDto, userId: string) {
    return this.structure.createStrategy(
      {
        alphaCode: dto.strategyId,
        goalId: dto.goalId,
        name: dto.strategyName,
        year: dto.year,
      },
      userId,
    );
  }

  async updateStrategy(
    strategyId: string,
    dto: UpdateStrategyDto,
    userId: string,
  ) {
    return this.structure.updateNode(
      {
        kind: 'strategy',
        lineageId: strategyId,
        year: dto.year,
        patch: { strategyName: dto.strategyName },
      },
      userId,
    );
  }

  async deleteStrategy(strategyId: string, year: number, userId: string) {
    return this.structure.abolishNode(
      { kind: 'strategy', lineageId: strategyId, year },
      userId,
    );
  }

  async createTask(dto: UpsertTaskDto, userId: string) {
    const parsed = parseTaskCode(dto.taskCode);
    return this.structure.createTask(
      {
        alphaCode: parsed.alphaCode,
        hangulCode: dto.hangulCode || parsed.hangulCode,
        name: dto.taskName,
        strategyId: dto.strategyId,
        year: dto.year,
        isSpecialized: dto.isSpecialized,
        primaryDept: dto.primaryDept,
      },
      userId,
    );
  }

  async updateTask(taskCode: string, dto: UpdateTaskDto, userId: string) {
    const patch: Record<string, unknown> = {};
    if (dto.taskName !== undefined) patch.taskName = dto.taskName;
    if (dto.hangulCode !== undefined) patch.hangulCode = dto.hangulCode;
    if (dto.isSpecialized !== undefined) patch.isSpecialized = dto.isSpecialized;
    if (dto.primaryDept !== undefined) patch.primaryDept = dto.primaryDept;
    if (dto.relatedDepts !== undefined) patch.relatedDepts = dto.relatedDepts;
    return this.structure.updateNode(
      { kind: 'task', lineageId: taskCode, year: dto.year, patch },
      userId,
    );
  }

  async deleteTask(taskCode: string, year: number, userId: string) {
    return this.structure.abolishNode(
      { kind: 'task', lineageId: taskCode, year },
      userId,
    );
  }

  async createSubtask(dto: CreateSubtaskDto, userId: string) {
    return this.structure.createSubtask(
      {
        taskCode: dto.taskCode,
        hangulCode: dto.hangulCode ?? '',
        seqNo: dto.seqNo,
        name: dto.subtaskName,
        purpose: dto.purpose,
        method: dto.method,
        year: dto.year,
      },
      userId,
    );
  }

  async updateSubtask(
    subtaskCode: string,
    dto: UpdateSubtaskDto,
    userId: string,
  ) {
    return this.structure.updateNode(
      {
        kind: 'subtask',
        lineageId: subtaskCode,
        year: dto.year,
        patch: {
          subtaskName: dto.subtaskName,
          hangulCode: dto.hangulCode,
          purpose: dto.purpose,
          method: dto.method,
        },
      },
      userId,
    );
  }

  async deleteSubtask(subtaskCode: string, year: number, userId: string) {
    return this.structure.abolishNode(
      { kind: 'subtask', lineageId: subtaskCode, year },
      userId,
    );
  }

  async replaceSubtasks(taskCode: string, dto: ReplaceSubtasksDto) {
    await this.assertTaskExists(taskCode);
    const seen = new Set<string>();
    for (const s of dto.subtasks) {
      if (seen.has(s.subtaskCode)) {
        throw new BadRequestException(
          `세부과제 코드가 중복됩니다: ${s.subtaskCode}`,
        );
      }
      seen.add(s.subtaskCode);
    }
    await this.subtaskRepo.delete({ taskCode });
    const kept = new Set(dto.subtasks.map((s) => s.subtaskCode));
    const budgets = await this.budgetRepo.find({ where: { taskCode } });
    const staleIds = budgets
      .filter((b) => b.subtaskCode && !kept.has(b.subtaskCode))
      .map((b) => b.budgetId);
    if (staleIds.length > 0) {
      await this.budgetRepo.delete(staleIds);
    }
    if (dto.subtasks.length === 0) return [];
    return this.subtaskRepo.save(
      dto.subtasks.map((s, index) =>
        this.subtaskRepo.create({
          taskCode,
          subtaskCode: s.subtaskCode,
          subtaskName: s.subtaskName,
          displayOrder: index,
        }),
      ),
    );
  }

  /* ── 관리자: KPI ── */

  async createKpi(dto: UpsertKpiDto, userId: string) {
    if (!dto.taskCode) {
      throw new BadRequestException('KPI는 실행과제에 묶여야 합니다.');
    }
    const parsed = parseKpiCode(dto.kpiCode);
    const row = await this.structure.createKpi(
      {
        kpiCode: parsed.alphaCode,
        taskCode: dto.taskCode,
        name: dto.kpiName,
        year: dto.year,
        unit: dto.unit,
        primaryDept: dto.primaryDept,
      },
      userId,
    );
    if (
      dto.baseline !== undefined ||
      dto.baselineRef !== undefined ||
      dto.formula !== undefined
    ) {
      await this.structure.updateNode(
        {
          kind: 'kpi',
          lineageId: row.kpiCode,
          year: dto.year,
          patch: {
            baseline: dto.baseline,
            baselineRef: dto.baselineRef,
            formula: dto.formula,
          },
        },
        userId,
      );
    }
    return row;
  }

  async updateKpi(kpiCode: string, dto: UpdateKpiDto, userId: string) {
    const patch: Record<string, unknown> = {};
    if (dto.kpiName !== undefined) patch.kpiName = dto.kpiName;
    if (dto.unit !== undefined) patch.unit = dto.unit;
    if (dto.primaryDept !== undefined) patch.primaryDept = dto.primaryDept;
    if (dto.baseline !== undefined) patch.baseline = dto.baseline;
    if (dto.baselineRef !== undefined) patch.baselineRef = dto.baselineRef;
    if (dto.formula !== undefined) patch.formula = dto.formula;
    return this.structure.updateNode(
      { kind: 'kpi', lineageId: kpiCode, year: dto.year, patch },
      userId,
    );
  }

  async deleteKpi(kpiCode: string, year: number, userId: string) {
    return this.structure.abolishNode(
      { kind: 'kpi', lineageId: kpiCode, year },
      userId,
    );
  }

  listChanges() {
    return this.structure.listChanges();
  }

  rollbackChange(logId: number, userId: string) {
    return this.structure.rollback(logId, userId);
  }
