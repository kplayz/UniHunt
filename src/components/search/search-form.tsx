"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { SearchCriteria } from "@/lib/types";
import {
  CANDIDATE_TYPES,
  COURSE_LEVELS,
  COURSE_TYPES,
  MAX_SEARCH_COUNTRIES,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CountryMultiSelect } from "./country-multi-select";

interface SearchFormProps {
  criteria: SearchCriteria;
  onChange: (criteria: SearchCriteria) => void;
  onSearch: () => void;
  loading: boolean;
  restoredAt?: string | null;
  warning?: string | null;
}

export function SearchForm({
  criteria,
  onChange,
  onSearch,
  loading,
  restoredAt,
  warning,
}: SearchFormProps) {
  function update<K extends keyof SearchCriteria>(key: K, value: SearchCriteria[K]) {
    onChange({ ...criteria, [key]: value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          Course Search Criteria
        </CardTitle>
        <CardDescription>
          Fill in your preferences and candidate details. Grades, subjects, qualification,
          curriculum, and budget are all used, and each course is labelled Dream, Reach, or Target.
          Each selected country is searched independently, then results are combined.
          {restoredAt
            ? ` Last search restored from ${new Date(restoredAt).toLocaleString()}.`
            : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
          className="grid gap-6"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Course Level</Label>
              <Select
                value={criteria.courseLevel || undefined}
                onValueChange={(v) => update("courseLevel", v as SearchCriteria["courseLevel"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Course Type</Label>
              <Select
                value={criteria.courseType || undefined}
                onValueChange={(v) => update("courseType", v as SearchCriteria["courseType"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialization">Specialization</Label>
              <Input
                id="specialization"
                placeholder="e.g. Robotics and Mechatronics"
                value={criteria.specialization}
                onChange={(e) => update("specialization", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Countries (multi-select)</Label>
              <CountryMultiSelect
                selected={criteria.countries}
                onChange={(countries) => update("countries", countries)}
              />
              <p
                className={
                  criteria.countries.length > MAX_SEARCH_COUNTRIES
                    ? "text-xs text-amber-700 dark:text-amber-300"
                    : "text-xs text-muted-foreground"
                }
              >
                Each country is searched separately. Select at most{" "}
                {MAX_SEARCH_COUNTRIES} countries.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Candidate Type</Label>
              <Select
                value={criteria.candidateType || undefined}
                onValueChange={(v) =>
                  update("candidateType", v as SearchCriteria["candidateType"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select candidate type" />
                </SelectTrigger>
                <SelectContent>
                  {CANDIDATE_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-4 text-sm font-medium">Candidate Background</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lastQualification">Last Qualification</Label>
                <Input
                  id="lastQualification"
                  placeholder="e.g. High School Diploma, B.Tech"
                  value={criteria.lastQualification}
                  onChange={(e) => update("lastQualification", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastSchool">Last School / College</Label>
                <Input
                  id="lastSchool"
                  placeholder="Institution name"
                  value={criteria.lastSchool}
                  onChange={(e) => update("lastSchool", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="curriculum">Curriculum</Label>
                <Input
                  id="curriculum"
                  placeholder="e.g. IB, CBSE, A-Levels, AP"
                  value={criteria.curriculum}
                  onChange={(e) => update("curriculum", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subjects">Subjects / Courses</Label>
                <Input
                  id="subjects"
                  placeholder="e.g. Physics, Math, Chemistry"
                  value={criteria.subjects}
                  onChange={(e) => update("subjects", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grades">Grades / GPA / CGPA</Label>
                <Input
                  id="grades"
                  placeholder="e.g. 3.8 GPA, 85%, AAB"
                  value={criteria.grades}
                  onChange={(e) => update("grades", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgetMax">Max Annual Budget (USD)</Label>
                <Input
                  id="budgetMax"
                  type="number"
                  min="0"
                  placeholder="e.g. 25000"
                  value={criteria.budgetMax}
                  onChange={(e) => update("budgetMax", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalNotes">Additional Notes</Label>
            <Textarea
              id="additionalNotes"
              placeholder="Any other preferences: campus size, research focus, work opportunities..."
              value={criteria.additionalNotes}
              onChange={(e) => update("additionalNotes", e.target.value)}
              rows={3}
            />
          </div>

          {warning ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
            >
              {warning}
            </div>
          ) : null}

          <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                {criteria.countries.length > 1
                  ? "Searching each country..."
                  : "Searching..."}
              </>
            ) : (
              <>
                <Sparkles />
                Find Universities & Courses
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
