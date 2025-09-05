export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      players: {
        Row: {
          personId: number | null
          playerFullName: string | null
        }
        Insert: {
          personId?: number | null
          playerFullName?: string | null
        }
        Update: {
          personId?: number | null
          playerFullName?: string | null
        }
        Relationships: []
      }
      "shots_2013-14": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2014-15": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          saeson: string | null
          scoreAway: string | null
          scoreHome: string | null
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          saeson?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          saeson?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2015-16": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string | null
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string | null
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string | null
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2016-17": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string | null
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: number | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string | null
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: number | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string | null
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: number | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2017-18": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: number | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: number | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: number | null
        }
        Relationships: []
      }
      "shots_2018-19": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2019-20": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: number | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: number | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: number | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2020-21": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2021-22": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2022-23": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2023-24": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
      "shots_2024-25": {
        Row: {
          ABS_TIME: number | null
          actionId: number | null
          actionNumber: number | null
          actionType: string | null
          clock: string | null
          contest_label: string | null
          contest_reasons: string | null
          contest_score: string | null
          description: string | null
          gameId: number | null
          isFieldGoal: number | null
          location: string | null
          period: number | null
          personId: number | null
          playerName: string | null
          playerNameI: string | null
          pointsTotal: string | null
          scoreAway: string | null
          scoreHome: string | null
          season: string
          SHOT_CLOCK_APPROX: string | null
          SHOT_CLOCK_SOURCE: string | null
          shotDistance: string | null
          shotResult: string | null
          shotValue: number | null
          subType: string | null
          teamId: number | null
          teamTricode: string | null
          videoAvailable: string | null
          xLegacy: string | null
          yLegacy: string | null
        }
        Insert: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Update: {
          ABS_TIME?: number | null
          actionId?: number | null
          actionNumber?: number | null
          actionType?: string | null
          clock?: string | null
          contest_label?: string | null
          contest_reasons?: string | null
          contest_score?: string | null
          description?: string | null
          gameId?: number | null
          isFieldGoal?: number | null
          location?: string | null
          period?: number | null
          personId?: number | null
          playerName?: string | null
          playerNameI?: string | null
          pointsTotal?: string | null
          scoreAway?: string | null
          scoreHome?: string | null
          season?: string
          SHOT_CLOCK_APPROX?: string | null
          SHOT_CLOCK_SOURCE?: string | null
          shotDistance?: string | null
          shotResult?: string | null
          shotValue?: number | null
          subType?: string | null
          teamId?: number | null
          teamTricode?: string | null
          videoAvailable?: string | null
          xLegacy?: string | null
          yLegacy?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
